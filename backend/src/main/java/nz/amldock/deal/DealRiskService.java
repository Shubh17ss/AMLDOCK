package nz.amldock.deal;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
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

import java.util.List;

/**
 * The deal's risk position, derived from everything that feeds it.
 *
 * <p>Derived rather than accepted from a client: a rating that disagrees with its own inputs is
 * an unfalsifiable AML record. Keeping the rule in one class is what makes that hold across every
 * write path — and from V35 there is more than one, because the ownership structure now has a say.
 *
 * <h2>The rule</h2>
 * <pre>
 * HIGH when  the property was on-sold quickly
 *        OR  any node on the deal reports a nominee (director, shareholder or limited partner)
 *        OR  any node on the deal reports a complex ownership structure
 *        OR  any trust on the deal holds an extensive or diverse asset portfolio
 * otherwise LOW.
 * </pre>
 *
 * <h2>Three properties worth stating</h2>
 *
 * <p><strong>It recomputes; it does not latch.</strong> Answering yes and then no drops the rating
 * back, exactly as toggling on-sold-quickly always has. A rule that only ratchets upward cannot be
 * reconciled against the answers on screen, which defeats the point of deriving it at all.
 *
 * <p><strong>Every input is read every time.</strong> A deal edit re-reads the nodes and a node
 * edit re-reads the deal, so neither can clear a HIGH the other is still asserting.
 *
 * <p><strong>It is not a user edit.</strong> Node editing happens during compliance review, when
 * the deal is no longer editable, so this deliberately does not go through
 * {@code DealService.mustFindEditable}. It writes a derived field on the caller's behalf.
 *
 * <p>OVERRIDE ratings were pinned by compliance and are left alone.
 */
@Service
public class DealRiskService {

    private static final Logger log = LoggerFactory.getLogger(DealRiskService.class);

    private final DealRepository deals;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final AuditService audit;

    public DealRiskService(DealRepository deals,
                           OwnershipStructureRepository structures,
                           OwnershipNodeRepository nodes,
                           AuditService audit) {
        this.deals = deals;
        this.structures = structures;
        this.nodes = nodes;
        this.audit = audit;
    }

    /**
     * Applies the rule to a deal already in hand.
     *
     * <p>Used by {@code DealService} on create and update, where the entity is loaded and the id
     * may not exist yet.
     *
     * @return true when the rating changed
     */
    public boolean apply(Deal deal) {
        if (deal.getRiskRatingSource() == RiskRatingSource.OVERRIDE) return false;

        RiskRating previous = deal.getRiskRating();
        RiskRating next = derive(deal);
        deal.setRiskRating(next);
        return previous != next;
    }

    /**
     * Re-derives a deal's rating after something other than the deal itself changed — today, one
     * of its ownership nodes.
     *
     * @return the rating it had before, or null if nothing changed (including when the deal is
     *         missing or pinned by an override). Callers use that to audit only real transitions.
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
        String because = reasonFor(dealId);
        audit.record(AuditAction.DEAL_RISK_CHANGED, "Deal", dealId,
                "Risk " + previous + " -> " + deal.getRiskRating()
                        + (because.isEmpty() ? "" : " because " + because));

        log.debug("Deal {} risk {} -> {}", dealId, previous, deal.getRiskRating());
        return previous;
    }

    private RiskRating derive(Deal deal) {
        if (Boolean.TRUE.equals(deal.getOnSoldQuickly())) return RiskRating.HIGH;
        return anyNodeRaisesRisk(deal.getId()) ? RiskRating.HIGH : RiskRating.LOW;
    }

    /**
     * Whether any node on the deal answers one of the two risk-raising questions.
     *
     * <p>Null counts as "no". The four plain yes/no questions are stored nullable so an untouched
     * row does not read as answers nobody gave, and an unanswered question is not evidence of
     * anything — least of all of risk.
     */
    private boolean anyNodeRaisesRisk(Long dealId) {
        if (dealId == null) return false;   // a deal being created has no structure yet
        OwnershipStructure structure = structures.findByDealId(dealId).orElse(null);
        if (structure == null) return false;

        List<OwnershipNode> all = nodes.findAllByOwnershipStructureIdOrderByIdAsc(structure.getId());
        return all.stream().anyMatch(DealRiskService::raisesRisk);
    }

    /**
     * The risk-raising answers, in one place.
     *
     * <p>Every entity type worked through adds to this list, so the rule and the audit line
     * read it from the same predicate. Two copies would eventually disagree about why a deal
     * sits where it does, and the disagreement would surface during an audit.
     */
    private static boolean raisesRisk(OwnershipNode n) {
        return reason(n) != null;
    }

    /** The answer raising this node's risk, phrased for an audit line, or null if none does. */
    private static String reason(OwnershipNode n) {
        String name = "\"" + n.getDisplayName() + "\"";
        if (n.getNomineeStatus() == NomineeStatus.YES) {
            // One column, two questions: a company is asked about a nominee director or
            // shareholder, a limited partnership about a nominee limited partner. The
            // consequence is identical, so the audit line only has to name it correctly.
            return name + (n.getNodeType() == NodeType.LIMITED_PARTNERSHIP
                    ? " reports a nominee limited partner"
                    : " reports a nominee director/shareholder");
        }
        if (Boolean.TRUE.equals(n.getCompanyComplexOwnership())) {
            return name + " reports a complex ownership structure";
        }
        if (n.getTrustHoldingComplexity() == TrustHoldingComplexity.EXTENSIVE_DIVERSE_PORTFOLIO) {
            return name + " holds an extensive or diverse asset portfolio";
        }
        return null;
    }

    /** Why the deal sits where it does, for an audit line. Empty when nothing raises it. */
    public String reasonFor(Long dealId) {
        OwnershipStructure structure = dealId == null
                ? null
                : structures.findByDealId(dealId).orElse(null);
        if (structure == null) return "";

        return nodes.findAllByOwnershipStructureIdOrderByIdAsc(structure.getId()).stream()
                .map(DealRiskService::reason)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse("");
    }
}
