package nz.amldock.deal;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NomineeStatus;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.ownership.TrustHoldingComplexity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The deal's risk position, derived from everything that feeds it.
 *
 * <p>Derived rather than accepted from a client: a rating that disagrees with its own inputs is
 * an unfalsifiable AML record. Keeping the rule in one class is what makes that hold across every
 * write path — and there is more than one, because the ownership structure has a say too.
 *
 * <h2>The rule</h2>
 *
 * <p>Since V46 it is a score rather than a switch. Every answer that bears on risk contributes
 * points, the total lands on {@code deal.risk_value}, and the band follows from it —
 * {@link RiskRating#forValue}, which is LOW 0-2, MEDIUM 3-5, HIGH 6 and above.
 *
 * <pre>
 * THE DEAL
 *   ownership tenure     0-18 months +6, 19-35 +2, 36 and over nothing
 *   met face to face and sighted original IDs?   No +2
 *   foreign exposure     the country scale (CountryRisk)
 *
 * EVERY OWNER ON THE STRUCTURE, added up rather than taking the worst
 *   country              jurisdiction, or country of residence for a person — the same scale
 *   trust holdings       unascertainable +6, extensive/diverse +4, more than one asset +2
 *   discretionary trust? No +2
 *   nominee director/shareholder, or nominee limited partner?   Yes +6
 *   complex ownership structure?   Yes +3
 *   a new developer?     Yes +2
 *   used for personal assets?   Yes +2
 * </pre>
 *
 * <p><strong>Owners add up.</strong> Four India-resident individuals score +24, not +6. That is a
 * deliberate choice and not the only defensible one: it says that concentration of a concern is
 * itself the concern, which is the reading a scored model exists to express.
 *
 * <h2>Four properties worth stating</h2>
 *
 * <p><strong>It recomputes; it does not latch.</strong> Answering yes and then no drops the score
 * back. A rule that only ratchets upward cannot be reconciled against the answers on screen,
 * which defeats the point of deriving it at all.
 *
 * <p><strong>Every input is read every time.</strong> A deal edit re-reads the nodes and a node
 * edit re-reads the deal, so neither can clear points the other is still asserting.
 *
 * <p><strong>It is not a user edit.</strong> Node editing happens during compliance review, when
 * the deal is no longer editable, so this deliberately does not go through
 * {@code DealService.mustFindEditable}. It writes derived fields on the caller's behalf.
 *
 * <p><strong>An override pins the band, not the score.</strong> {@code risk_value} and the factor
 * list keep moving underneath a pinned rating, because the Risk tab shows the calculated position
 * beside the pinned one — a reviewer deciding whether to lift an override needs to see what the
 * file would say on its own.
 */
@Service
public class DealRiskService {

    private static final Logger log = LoggerFactory.getLogger(DealRiskService.class);

    /**
     * One contributing answer and what it was worth.
     *
     * <p>The question and the answer travel separately - {@code label} is what was asked,
     * {@code value} is what came back. Fused into one sentence they could not be laid out as a
     * column a reviewer scans, and the wording of every card would be the server's decision.
     *
     * <p>{@code value} is null on the country factors, which carry {@code countryCode} instead:
     * the browser renders a flag and the country's full name from it, which it could not do
     * from a name baked in here.
     *
     * <p>{@code nodeType} is the {@code NodeType} enum name, which is exactly the key the
     * frontend's NODE_VISUAL table is indexed by, so the glyph beside an owner here is the same
     * glyph it has on the Structure tab. Null on the deal's own answers.
     */
    public record RiskFactor(String code, String label, String value, int points,
                             Long nodeId, String nodeName, String nodeType, String countryCode) {

        /** One of the deal's own answers: no owner behind it. */
        static RiskFactor deal(String code, String label, String value, int points) {
            return new RiskFactor(code, label, value, points, null, null, null, null);
        }

        /** An owner's answer. */
        static RiskFactor of(String code, String label, String value, int points, OwnershipNode n) {
            return new RiskFactor(code, label, value, points,
                    n.getNodeId(), n.getDisplayName(), n.getNodeType().name(), null);
        }
    }

    /**
     * A question that bears on the score and has not been answered.
     *
     * <p>Not the same as an answer of "no". The Approve button is gated on this list being empty,
     * so a question nobody put to anybody has to be distinguishable from one that was asked and
     * came back negative — which is why the columns behind these are nullable in the first place.
     */
    public record RiskGap(String code, String label, Long nodeId, String nodeName,
                          String nodeType) {

        static RiskGap deal(String code, String label) {
            return new RiskGap(code, label, null, null, null);
        }

        static RiskGap of(String code, String label, OwnershipNode n) {
            return new RiskGap(code, label, n.getNodeId(), n.getDisplayName(),
                    n.getNodeType().name());
        }
    }

    /** The whole picture: the score, the band it falls in, and the workings behind both. */
    public record RiskAssessment(int value, RiskRating rating,
                                 List<RiskFactor> factors, List<RiskGap> unanswered) {
        public boolean complete() { return unanswered.isEmpty(); }
    }

    private final DealRepository deals;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final BeneficialOwnerRepository people;
    private final AuditService audit;

    public DealRiskService(DealRepository deals,
                           OwnershipStructureRepository structures,
                           OwnershipNodeRepository nodes,
                           BeneficialOwnerRepository people,
                           AuditService audit) {
        this.deals = deals;
        this.structures = structures;
        this.nodes = nodes;
        this.people = people;
        this.audit = audit;
    }

    /**
     * Applies the rule to a deal already in hand.
     *
     * <p>Used by {@code DealService} on create and update, where the entity is loaded and the id
     * may not exist yet.
     *
     * <p>Writes {@code riskValue} unconditionally and {@code riskRating} only while the rating is
     * DERIVED.
     *
     * <h3>When an approval is withdrawn</h3>
     *
     * <p>Two ways, and the second is easy to miss. <strong>The score moved</strong> - an approval
     * is a sign-off on one number, and one that survived the answers it was given about would be
     * a claim nobody made. <strong>Or the deal stopped being complete</strong>, which is what
     * happens when an owner is added to the structure: its risk questions all start null, so the
     * deal gains unanswered questions worth <em>zero points</em>. The score does not move at all,
     * and testing only the score left the deal flagged as approved while carrying questions that
     * would have refused the approval had anyone asked for it then.
     *
     * <p>Withdrawing on incomplete is safe as an unconditional rule because approval is only ever
     * grantable while complete - see {@code DealService.approveRisk}. An approved deal that is
     * now incomplete can therefore only have got there by something changing underneath it.
     *
     * @return true when the rating changed
     */
    public boolean apply(Deal deal) {
        RiskAssessment assessment = assess(deal);

        int previousValue = deal.getRiskValue();
        deal.setRiskValue(assessment.value());

        boolean scoreMoved = previousValue != assessment.value();
        boolean nowIncomplete = !assessment.complete();
        if (deal.isRiskApproved() && (scoreMoved || nowIncomplete)) {
            deal.setRiskApproved(false);
            deal.setRiskApprovedByUserId(null);
            deal.setRiskApprovedAt(null);
            // Guarded on the id: apply() also runs on create, before the row exists, where there
            // is nothing to have approved and nothing to audit against.
            if (deal.getId() != null) {
                audit.record(AuditAction.DEAL_RISK_APPROVAL_WITHDRAWN, "Deal", deal.getId(),
                        "Risk approval withdrawn on deal " + deal.getReference() + " because "
                                + (nowIncomplete
                                        ? assessment.unanswered().size()
                                          + " question(s) affecting the risk are unanswered"
                                        : "the score moved " + previousValue + " -> "
                                          + assessment.value()));
            }
        }

        if (deal.getRiskRatingSource() == RiskRatingSource.OVERRIDE) return false;

        RiskRating previous = deal.getRiskRating();
        deal.setRiskRating(assessment.rating());
        return previous != assessment.rating();
    }

    /**
     * Re-derives a deal's position after something other than the deal itself changed — today,
     * one of its ownership nodes.
     *
     * @return the rating it had before, or null if the rating did not change (including when the
     *         deal is missing or pinned by an override). Callers use that to audit only real
     *         transitions; the score and any withdrawn approval are still written either way.
     */
    @Transactional
    public RiskRating recomputeFor(Long dealId) {
        if (dealId == null) return null;
        Deal deal = deals.findById(dealId).orElse(null);
        if (deal == null) return null;

        RiskRating previous = deal.getRiskRating();
        if (!apply(deal)) return null;

        // Audited here rather than at the call site: this is the only place that knows a
        // transition happened, and a rating that moved with no deal edit behind it is exactly
        // the kind of change an auditor will ask about.
        String because = reasonFor(deal);
        audit.record(AuditAction.DEAL_RISK_CHANGED, "Deal", dealId,
                "Risk " + previous + " -> " + deal.getRiskRating()
                        + " (score " + deal.getRiskValue() + ")"
                        + (because.isEmpty() ? "" : " because " + because));

        log.debug("Deal {} risk {} -> {} (score {})",
                dealId, previous, deal.getRiskRating(), deal.getRiskValue());
        return previous;
    }

    /** The whole picture for a deal by id, for the Risk tab. Empty when the deal is gone. */
    @Transactional(readOnly = true)
    public RiskAssessment assess(Long dealId) {
        Deal deal = dealId == null ? null : deals.findById(dealId).orElse(null);
        if (deal == null) return new RiskAssessment(0, RiskRating.LOW, List.of(), List.of());
        return assess(deal);
    }

    /**
     * The score, the band and the workings, from the deal and every owner under it.
     *
     * <p>Reads rather than writes, so the Risk tab and {@link #apply} cannot disagree about why a
     * deal sits where it does — they are the same computation, called twice.
     */
    public RiskAssessment assess(Deal deal) {
        List<RiskFactor> factors = new ArrayList<>();
        List<RiskGap> gaps = new ArrayList<>();

        scoreDeal(deal, factors, gaps);

        List<OwnershipNode> all = nodesOf(deal.getId());
        Map<Long, String> residence = countriesOfResidence(all);
        for (OwnershipNode node : all) {
            // Guarded rather than looked up directly: every entity node has a null person id,
            // and Map.of() — what countriesOfResidence returns when there are no individuals —
            // throws on a null key rather than answering null.
            Long personId = node.getBeneficialOwnerId();
            scoreNode(node, personId == null ? null : residence.get(personId), factors, gaps);
        }

        int value = factors.stream().mapToInt(RiskFactor::points).sum();
        return new RiskAssessment(value, RiskRating.forValue(value),
                List.copyOf(factors), List.copyOf(gaps));
    }

    /* ---------- the deal's own answers ---------- */

    private static final String TENURE = "Ownership tenure";
    private static final String FACE_TO_FACE = "Met face to face, original IDs verified";
    private static final String FOREIGN_EXPOSURE = "Foreign exposure";

    private static void scoreDeal(Deal deal, List<RiskFactor> factors, List<RiskGap> gaps) {
        Integer months = tenureMonths(deal);
        if (months == null) {
            gaps.add(RiskGap.deal("TENURE", TENURE));
        } else if (months <= 18) {
            factors.add(RiskFactor.deal("TENURE", TENURE, months + " months", 6));
        } else if (months < 36) {
            factors.add(RiskFactor.deal("TENURE", TENURE, months + " months", 2));
        }

        Boolean verified = deal.getFaceToFaceIdVerified();
        if (verified == null) {
            gaps.add(RiskGap.deal("FACE_TO_FACE", FACE_TO_FACE));
        } else if (!verified) {
            factors.add(RiskFactor.deal("FACE_TO_FACE", FACE_TO_FACE, "No", 2));
        }

        String exposure = deal.getForeignExposureCountry();
        if (exposure == null || exposure.isBlank()) {
            gaps.add(RiskGap.deal("FOREIGN_EXPOSURE", FOREIGN_EXPOSURE));
        } else {
            int points = CountryRisk.pointsFor(exposure);
            if (points > 0) {
                // Same shape as an owner's country: the code travels, not a rendered name.
                factors.add(new RiskFactor("FOREIGN_EXPOSURE", FOREIGN_EXPOSURE, null, points,
                        null, null, null, exposure));
            }
        }
    }

    /**
     * Total months held, or null when neither box was filled in.
     *
     * <p>One box answered is an answer: a client who has owned it for four years leaves months
     * blank, and demanding a zero there would turn a complete answer into a gap.
     */
    private static Integer tenureMonths(Deal deal) {
        Integer years = deal.getOwnershipTenureYears();
        Integer months = deal.getOwnershipTenureMonths();
        if (years == null && months == null) return null;
        return (years == null ? 0 : years) * 12 + (months == null ? 0 : months);
    }

    /* ---------- each owner's answers ---------- */

    /** The entity types the form asks a country of — see {@code NodeFormFields}. */
    private static final Set<NodeType> ASKED_FOR_COUNTRY = Set.of(
            NodeType.PRIVATE_COMPANY, NodeType.LISTED_COMPANY, NodeType.LIMITED_PARTNERSHIP,
            NodeType.TRUST, NodeType.INCORPORATED_SOCIETY, NodeType.CHARITY,
            NodeType.GOVERNMENT_AGENCY, NodeType.DECEASED_ESTATE);

    /**
     * What one node contributes, and what it has not been asked.
     *
     * <p>A question only counts as unanswered when it is one this type is actually asked. A
     * trust's holdings are not a gap on a company, and listing them as one would send a reviewer
     * looking for a field that does not exist.
     */
    private static void scoreNode(OwnershipNode n, String personCountry,
                                  List<RiskFactor> factors, List<RiskGap> gaps) {
        NodeType type = n.getNodeType();
        Long id = n.getNodeId();
        String name = n.getDisplayName();

        if (type == NodeType.INDIVIDUAL) {
            country(factors, gaps, n, "Country of residence", personCountry);
        } else if (ASKED_FOR_COUNTRY.contains(type)) {
            country(factors, gaps, n,
                    type == NodeType.TRUST ? "Jurisdiction" : "Country of incorporation",
                    n.getJurisdictionCountry());
        }

        if (type == NodeType.TRUST) {
            TrustHoldingComplexity holdings = n.getTrustHoldingComplexity();
            if (holdings == null) {
                gaps.add(RiskGap.of("TRUST_HOLDINGS", "Trust holdings", n));
            } else {
                int points = pointsFor(holdings);
                if (points > 0) {
                    factors.add(RiskFactor.of("TRUST_HOLDINGS", "Trust holdings",
                            label(holdings), points, n));
                }
            }
            no(factors, gaps, n, "TRUST_DISCRETIONARY", "Discretionary trust",
                    n.getTrustDiscretionary(), 2);
        }

        if (type == NodeType.PRIVATE_COMPANY || type == NodeType.LIMITED_PARTNERSHIP) {
            // One column, two questions: a company is asked about a nominee director or
            // shareholder, a limited partnership about a nominee limited partner. The consequence
            // is identical, so only the wording has to know which was actually put.
            String asked = type == NodeType.LIMITED_PARTNERSHIP
                    ? "Nominee limited partner"
                    : "Nominee director/shareholder";
            NomineeStatus nominee = n.getNomineeStatus();
            if (nominee == null || nominee == NomineeStatus.NOT_ASKED) {
                gaps.add(RiskGap.of("NOMINEE", asked, n));
            } else if (nominee == NomineeStatus.YES) {
                factors.add(RiskFactor.of("NOMINEE", asked, "Yes", 6, n));
            }
        }

        if (type == NodeType.PRIVATE_COMPANY) {
            yes(factors, gaps, n, "COMPLEX_OWNERSHIP", "Complex ownership structure",
                    n.getCompanyComplexOwnership(), 3);
            yes(factors, gaps, n, "NEW_DEVELOPER", "New developer",
                    n.getCompanyNewDeveloper(), 2);
            yes(factors, gaps, n, "PERSONAL_ASSETS", "Used for personal assets",
                    n.getCompanyPersonalAssets(), 2);
        }
    }

    /**
     * A country answer, scored on the shared scale.
     *
     * <p>The label is the bare question and the code rides alongside, so the UI can render a flag
     * and the full country name. {@link #phrase} puts the code back into the audit line, which is
     * read as a sentence and has always named the country.
     */
    private static void country(List<RiskFactor> factors, List<RiskGap> gaps, OwnershipNode n,
                                String question, String countryCode) {
        if (countryCode == null || countryCode.isBlank()) {
            gaps.add(RiskGap.of("COUNTRY", question, n));
            return;
        }
        int points = CountryRisk.pointsFor(countryCode);
        if (points > 0) {
            factors.add(new RiskFactor("COUNTRY", question, null, points,
                    n.getNodeId(), n.getDisplayName(), n.getNodeType().name(), countryCode));
        }
    }

    /**
     * A yes/no question where YES costs points. Null is a gap; false costs nothing.
     *
     * <p>One label, not two. These used to carry a separate sentence for the answered case
     * ("Complex ownership structure") and the unanswered one ("Whether the ownership is
     * complex"), which is the same question written twice and free to drift. The answer is now
     * the literal Yes or No beside it.
     */
    private static void yes(List<RiskFactor> factors, List<RiskGap> gaps, OwnershipNode n,
                            String code, String label, Boolean answer, int points) {
        if (answer == null) gaps.add(RiskGap.of(code, label, n));
        else if (answer) factors.add(RiskFactor.of(code, label, "Yes", points, n));
    }

    /** A yes/no question where NO costs points — the discretionary-trust question. */
    private static void no(List<RiskFactor> factors, List<RiskGap> gaps, OwnershipNode n,
                           String code, String label, Boolean answer, int points) {
        if (answer == null) gaps.add(RiskGap.of(code, label, n));
        else if (!answer) factors.add(RiskFactor.of(code, label, "No", points, n));
    }

    private static int pointsFor(TrustHoldingComplexity holdings) {
        return switch (holdings) {
            case UNASCERTAINABLE -> 6;
            case EXTENSIVE_DIVERSE_PORTFOLIO -> 4;
            case MORE_THAN_ONE_PROPERTY_ASSET -> 2;
            case SINGLE_PROPERTY_ASSET -> 0;
        };
    }

    /** The answer, not a sentence about it — it sits after "Trust holdings:" on the card. */
    private static String label(TrustHoldingComplexity holdings) {
        return switch (holdings) {
            case UNASCERTAINABLE -> "Unascertainable";
            case EXTENSIVE_DIVERSE_PORTFOLIO -> "Extensive or diverse portfolio";
            case MORE_THAN_ONE_PROPERTY_ASSET -> "More than one property or asset";
            case SINGLE_PROPERTY_ASSET -> "A single property or asset";
        };
    }

    /* ---------- reading the structure ---------- */

    private List<OwnershipNode> nodesOf(Long dealId) {
        if (dealId == null) return List.of();   // a deal being created has no structure yet
        OwnershipStructure structure = structures.findByDealId(dealId).orElse(null);
        if (structure == null) return List.of();
        return nodes.findAllByOwnershipStructureIdOrderByIdAsc(structure.getId());
    }

    /**
     * Country of residence per person id, for the individuals on the structure.
     *
     * <p>An individual's country lives on the shared person record rather than on the node — see
     * {@code BeneficialOwnerFields} — so it takes a second read. One batched query rather than one
     * per node: a structure with twenty people would otherwise be twenty round trips to add one
     * column, on a path that runs on every deal and node write.
     */
    private Map<Long, String> countriesOfResidence(List<OwnershipNode> all) {
        List<Long> personIds = all.stream()
                .filter(n -> n.getNodeType() == NodeType.INDIVIDUAL)
                .map(OwnershipNode::getBeneficialOwnerId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (personIds.isEmpty()) return Map.of();

        return people.findAllById(personIds).stream()
                .filter(p -> p.getCountryOfResidence() != null)
                .collect(Collectors.toMap(BeneficialOwner::getId,
                        BeneficialOwner::getCountryOfResidence));
    }

    /**
     * Why the deal sits where it does, for an audit line. Empty when nothing raises it.
     *
     * <p>The first factor only. The full list is what the Risk tab renders; an audit line is read
     * in a column beside forty others and has to fit on one of them.
     */
    public String reasonFor(Deal deal) {
        return assess(deal).factors().stream()
                .map(DealRiskService::phrase)
                .findFirst()
                .orElse("");
    }

    private static String phrase(RiskFactor f) {
        // The label is only the question now, so the audit line has to put the answer back:
        // "Nominee director/shareholder" on its own names something that was asked, not a cause
        // anybody could act on. Country factors carry their code instead of a value.
        String answer = f.value() != null ? f.value() : f.countryCode();
        String what = answer == null ? f.label() : f.label() + ": " + answer;
        return f.nodeName() == null ? what : "\"" + f.nodeName() + "\" — " + what;
    }
}
