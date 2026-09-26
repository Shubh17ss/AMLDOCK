package nz.amldock.deal;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.deal.DealRiskService.RiskAssessment;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NomineeStatus;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.ownership.TrustHoldingComplexity;
import nz.amldock.ownership.TrustType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The scored risk rule (V46).
 *
 * <p>The cases worth pinning are the ones a reader cannot work out by looking: the band
 * boundaries, the fact that owners add up rather than taking the worst, an override pinning the
 * band while the score keeps moving under it, and an approval being withdrawn the moment the
 * number it was given about changes.
 *
 * <p>A deal with no answers at all is not the neutral case. Three unanswered deal questions score
 * nothing but leave three gaps, so {@link #aDealNobodyHasAnsweredScoresNothingButIsNotComplete}
 * is the baseline every other test starts from — most set the three deal answers to their
 * zero-scoring values so that whatever they are actually testing is the only thing on the board.
 */
@ExtendWith(MockitoExtension.class)
class DealRiskServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long STRUCTURE_ID = 20L;

    @Mock DealRepository deals;
    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodes;
    @Mock BeneficialOwnerRepository people;
    @Mock AuditService audit;

    DealRiskService service;
    Deal deal;

    /** Node and person ids, so a test never has to care which number it got. */
    private final AtomicLong ids = new AtomicLong(100);

    @BeforeEach
    void setUp() {
        service = new DealRiskService(deals, structures, nodes, people, audit);

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setRiskRating(RiskRating.LOW);
        // The three deal-level questions, answered so they score nothing. A test that wants one
        // of them says so; the rest stay out of the arithmetic.
        deal.setOwnershipTenureYears(10);
        deal.setOwnershipTenureMonths(0);
        deal.setFaceToFaceIdVerified(true);
        deal.setForeignExposureCountry(CountryRisk.NONE);

        OwnershipStructure structure = new OwnershipStructure();
        ReflectionTestUtils.setField(structure, "id", STRUCTURE_ID);
        structure.setDealId(DEAL_ID);

        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.of(structure));
        lenient().when(nodes.findAllByOwnershipStructureIdOrderByIdAsc(STRUCTURE_ID))
                .thenReturn(List.of());
        lenient().when(people.findAllById(any())).thenReturn(List.of());
    }

    /* ---------- the bands ---------- */

    @Test
    void theBandsFollowTheScore() {
        assertThat(RiskRating.forValue(0)).isEqualTo(RiskRating.LOW);
        assertThat(RiskRating.forValue(2)).isEqualTo(RiskRating.LOW);
        assertThat(RiskRating.forValue(3)).isEqualTo(RiskRating.MEDIUM);
        assertThat(RiskRating.forValue(5)).isEqualTo(RiskRating.MEDIUM);
        assertThat(RiskRating.forValue(6)).isEqualTo(RiskRating.HIGH);
        assertThat(RiskRating.forValue(40)).isEqualTo(RiskRating.HIGH);
    }

    /* ---------- the deal's own answers ---------- */

    @Test
    void aDealNobodyHasAnsweredScoresNothingButIsNotComplete() {
        // Unanswered is not the same as answered No. Nothing scores, and nothing may be approved.
        Deal blank = new Deal();
        ReflectionTestUtils.setField(blank, "id", DEAL_ID);

        RiskAssessment a = service.assess(blank);

        assertThat(a.value()).isZero();
        assertThat(a.rating()).isEqualTo(RiskRating.LOW);
        assertThat(a.complete()).isFalse();
        assertThat(a.unanswered()).extracting(DealRiskService.RiskGap::code)
                .containsExactlyInAnyOrder("TENURE", "FACE_TO_FACE", "FOREIGN_EXPOSURE");
    }

    @Test
    void theTenureBands() {
        assertThat(scoreWithTenure(0, 0)).isEqualTo(6);
        assertThat(scoreWithTenure(1, 6)).isEqualTo(6);      // 18 months, the top of the band
        assertThat(scoreWithTenure(1, 7)).isEqualTo(2);      // 19 months, the next one down
        assertThat(scoreWithTenure(2, 11)).isEqualTo(2);     // 35 months
        assertThat(scoreWithTenure(3, 0)).isZero();          // 36 months and over scores nothing
        assertThat(scoreWithTenure(30, 0)).isZero();
    }

    @Test
    void oneTenureBoxFilledInIsStillAnAnswer() {
        // A client who has owned it four years leaves months blank. Demanding a zero there would
        // turn a complete answer into a gap and hold up the approval over nothing.
        deal.setOwnershipTenureYears(4);
        deal.setOwnershipTenureMonths(null);

        RiskAssessment a = service.assess(deal);

        assertThat(a.value()).isZero();
        assertThat(a.complete()).isTrue();
    }

    @Test
    void notMeetingTheClientFaceToFaceAddsTwo() {
        deal.setFaceToFaceIdVerified(false);

        assertThat(service.assess(deal).value()).isEqualTo(2);
    }

    @Test
    void meetingThemAddsNothingAndAnUnansweredQuestionIsNotEvidenceOfAnything() {
        deal.setFaceToFaceIdVerified(null);

        RiskAssessment a = service.assess(deal);

        assertThat(a.value()).isZero();
        assertThat(a.unanswered()).extracting(DealRiskService.RiskGap::code)
                .containsExactly("FACE_TO_FACE");
    }

    /* ---------- the country scale ---------- */

    @Test
    void theFourCountryBands() {
        assertThat(CountryRisk.pointsFor("IN")).isEqualTo(6);     // India
        assertThat(CountryRisk.pointsFor("TH")).isEqualTo(6);     // South-East Asia
        assertThat(CountryRisk.pointsFor("CN")).isEqualTo(6);     // China
        assertThat(CountryRisk.pointsFor("NG")).isEqualTo(6);     // Africa
        assertThat(CountryRisk.pointsFor("BR")).isEqualTo(3);     // South America
        assertThat(CountryRisk.pointsFor("JP")).isEqualTo(3);     // the rest of Asia
        assertThat(CountryRisk.pointsFor("GB")).isEqualTo(1);     // Europe
        assertThat(CountryRisk.pointsFor("US")).isEqualTo(1);     // North America
        assertThat(CountryRisk.pointsFor("NZ")).isZero();
        assertThat(CountryRisk.pointsFor("AU")).isZero();
        assertThat(CountryRisk.pointsFor("FJ")).isZero();         // the rest of Oceania
    }

    @Test
    void anUnknownOrAbsentCountryScoresNothingRatherThanThrowing() {
        // A deal must not become unratable because someone stored a code nobody has heard of.
        assertThat(CountryRisk.pointsFor("ZZ")).isZero();
        assertThat(CountryRisk.pointsFor(null)).isZero();
        assertThat(CountryRisk.pointsFor("")).isZero();
        assertThat(CountryRisk.pointsFor(CountryRisk.NONE)).isZero();
    }

    @Test
    void theDealsForeignExposureIsScoredOnTheSameScale() {
        deal.setForeignExposureCountry("IN");

        assertThat(service.assess(deal).value()).isEqualTo(6);
    }

    /* ---------- owners add up ---------- */

    @Test
    void everyOwnersCountryCounts() {
        // Four India-resident individuals score 24, not 6. Concentration of a concern is itself
        // the concern, which is the whole reason for scoring rather than switching.
        withPeople(individual("IN"), individual("IN"), individual("IN"), individual("IN"));

        assertThat(service.assess(deal).value()).isEqualTo(24);
    }

    @Test
    void anIndividualsCountryComesFromTheirPersonRecord() {
        // It lives on beneficial_owner, not on the node, so this is the one input that needs a
        // second read — and the one most likely to be quietly dropped.
        withPeople(individual("CN"));

        assertThat(service.assess(deal).value()).isEqualTo(6);
    }

    @Test
    void anIndividualWithNoPersonRecordIsAGapRatherThanAZero() {
        OwnershipNode n = node(NodeType.INDIVIDUAL, "Jane Marsh", x -> {});
        withNodes(n);

        RiskAssessment a = service.assess(deal);

        assertThat(a.value()).isZero();
        assertThat(a.unanswered()).extracting(DealRiskService.RiskGap::code).contains("COUNTRY");
    }

    @Test
    void aDealAndItsOwnersAddTogether() {
        deal.setForeignExposureCountry("IN");        // +6
        deal.setFaceToFaceIdVerified(false);         // +2
        withPeople(individual("GB"));                // +1

        assertThat(service.assess(deal).value()).isEqualTo(9);
    }

    /* ---------- the trust answers ---------- */

    @Test
    void theTrustHoldingBands() {
        assertThat(scoreOf(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.UNASCERTAINABLE)))).isEqualTo(6);
        assertThat(scoreOf(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.EXTENSIVE_DIVERSE_PORTFOLIO)))).isEqualTo(4);
        assertThat(scoreOf(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.MORE_THAN_ONE_PROPERTY_ASSET)))).isEqualTo(2);
        assertThat(scoreOf(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.SINGLE_PROPERTY_ASSET)))).isZero();
    }

    @Test
    void notKnowingWhatATrustHoldsCostsMoreThanKnowingItHoldsAGreatDeal() {
        // The ordering is the point of the new band: an absent fact beats a large measured one.
        assertThat(scoreOf(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.UNASCERTAINABLE))))
                .isGreaterThan(scoreOf(trust(n -> n.setTrustHoldingComplexity(
                        TrustHoldingComplexity.EXTENSIVE_DIVERSE_PORTFOLIO))));
    }

    @Test
    void aNonDiscretionaryTrustAddsTwoAndADiscretionaryOneAddsNothing() {
        assertThat(scoreOf(trust(n -> {
            n.setTrustHoldingComplexity(TrustHoldingComplexity.SINGLE_PROPERTY_ASSET);
            n.setTrustDiscretionary(false);
        }))).isEqualTo(2);

        assertThat(scoreOf(trust(n -> {
            n.setTrustHoldingComplexity(TrustHoldingComplexity.SINGLE_PROPERTY_ASSET);
            n.setTrustDiscretionary(true);
        }))).isZero();
    }

    @Test
    void theTrustTypeItselfDoesNotMoveTheScore() {
        // Risk-relevant to a reviewer, but not a rule. An asset protection trust holding one
        // house is not automatically a concern, and pretending otherwise would flag most of
        // the book.
        assertThat(scoreOf(trust(n -> {
            n.setTrustType(TrustType.ASSET_PROTECTION);
            n.setTrustDiscretionary(true);
            n.setTrustHoldingComplexity(TrustHoldingComplexity.SINGLE_PROPERTY_ASSET);
        }))).isZero();
    }

    /* ---------- the company and partnership answers ---------- */

    @Test
    void theCompanyAnswersAndWhatTheyAreWorth() {
        assertThat(scoreOf(company(n -> n.setNomineeStatus(NomineeStatus.YES)))).isEqualTo(6);
        assertThat(scoreOf(company(n -> n.setCompanyComplexOwnership(true)))).isEqualTo(3);
        assertThat(scoreOf(company(n -> n.setCompanyNewDeveloper(true)))).isEqualTo(2);
        assertThat(scoreOf(company(n -> n.setCompanyPersonalAssets(true)))).isEqualTo(2);
    }

    @Test
    void oneCompanyCanCarryEveryAnswerAtOnce() {
        assertThat(scoreOf(company(n -> {
            n.setNomineeStatus(NomineeStatus.YES);
            n.setCompanyComplexOwnership(true);
            n.setCompanyNewDeveloper(true);
            n.setCompanyPersonalAssets(true);
        }))).isEqualTo(13);
    }

    @Test
    void notAskedIsNotAYes() {
        // The default state of the nominee question. Treating it as YES would raise every
        // company ever added; treating it as NO is an answer nobody gave.
        RiskAssessment a = assessWith(company(n -> n.setNomineeStatus(NomineeStatus.NOT_ASKED)));

        assertThat(a.value()).isZero();
        assertThat(a.unanswered()).extracting(DealRiskService.RiskGap::code).contains("NOMINEE");
    }

    @Test
    void aNomineeLimitedPartnerCostsTheSameAsANomineeDirector() {
        // One column, two questions. Only the wording knows which was actually put.
        assertThat(scoreOf(limitedPartnership(n -> n.setNomineeStatus(NomineeStatus.YES))))
                .isEqualTo(6);
    }

    @Test
    void aLimitedPartnershipIsNotAskedTheCompanyQuestions() {
        // Listing a trust question as a gap on a partnership would send a reviewer looking for a
        // field that does not exist on the form in front of them.
        RiskAssessment a = assessWith(limitedPartnership(n -> {
            n.setNomineeStatus(NomineeStatus.NO);
            n.setJurisdictionCountry("NZ");
        }));

        assertThat(a.unanswered()).isEmpty();
    }

    /* ---------- it recomputes rather than latches ---------- */

    @Test
    void changingTheAnswerBackDropsTheScore() {
        deal.setRiskRating(RiskRating.HIGH);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.NO)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskValue()).isZero();
        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    @Test
    void oneInputClearingDoesNotClearAnother() {
        // The deal's own answer still scores. A node answering no is not a statement about how
        // long the client has owned the property.
        deal.setOwnershipTenureYears(0);
        deal.setOwnershipTenureMonths(6);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.NO)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    /* ---------- overrides and approval ---------- */

    @Test
    void aRatingPinnedByComplianceIsLeftAlone() {
        deal.setRiskRatingSource(RiskRatingSource.OVERRIDE);
        deal.setRiskRating(RiskRating.LOW);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    @Test
    void theScoreStillMovesUnderAPinnedRating() {
        deal.setRiskRatingSource(RiskRatingSource.OVERRIDE);
        deal.setRiskRating(RiskRating.LOW);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.apply(deal);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
        assertThat(deal.getRiskValue()).isEqualTo(6);
    }

    @Test
    void movingTheScoreWithdrawsAnApproval() {
        deal.setRiskValue(0);
        deal.setRiskApproved(true);
        deal.setRiskApprovedByUserId(9L);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.apply(deal);

        assertThat(deal.isRiskApproved()).isFalse();
        assertThat(deal.getRiskApprovedByUserId()).isNull();
    }

    @Test
    void aRecomputeThatLeavesTheScoreWhereItWasKeepsTheApproval() {
        // Saving a deal without touching anything that bears on risk must not quietly undo a
        // sign-off — that would make approval impossible to hold on a deal under active edit.
        deal.setRiskValue(0);
        deal.setRiskApproved(true);
        deal.setRiskApprovedByUserId(9L);

        service.apply(deal);

        assertThat(deal.isRiskApproved()).isTrue();
        assertThat(deal.getRiskApprovedByUserId()).isEqualTo(9L);
    }

    @Test
    void addingAnOwnerWithUnansweredQuestionsWithdrawsTheApproval() {
        // THE REGRESSION. A new company on the structure starts with every risk question null,
        // which adds gaps worth ZERO points. The score does not move at all, so a withdrawal
        // rule that tested only the score left the deal reading as approved while carrying
        // questions that would have refused the approval had anyone asked for it then.
        deal.setRiskValue(0);
        deal.setRiskApproved(true);
        deal.setRiskApprovedByUserId(9L);
        deal.setRiskApprovedAt(java.time.Instant.now());

        withNodes(company(n -> { /* nothing answered, which is how a node arrives */ }));

        service.apply(deal);

        assertThat(deal.getRiskValue()).isZero();          // the score genuinely did not move
        assertThat(deal.isRiskApproved()).isFalse();
        assertThat(deal.getRiskApprovedByUserId()).isNull();
        assertThat(deal.getRiskApprovedAt()).isNull();
    }

    @Test
    void theWithdrawalSaysWhichOfTheTwoReasonsItWas() {
        // An approval that disappears with nothing on the record is what an auditor asks about,
        // and "the score moved" and "somebody added an owner" are different answers.
        deal.setRiskValue(0);
        deal.setRiskApproved(true);
        deal.setReference("DEAL-2026-0001");
        withNodes(company(n -> { }));

        service.apply(deal);

        verify(audit).record(eq(AuditAction.DEAL_RISK_APPROVAL_WITHDRAWN), eq("Deal"), eq(DEAL_ID),
                contains("unanswered"));
    }

    @Test
    void anUnapprovedDealGainingAnOwnerIsNotAudited() {
        // Nothing was withdrawn, so there is nothing to say. Otherwise every node added to every
        // unapproved deal in the system would write a line claiming a sign-off fell away.
        withNodes(company(n -> { }));

        service.apply(deal);

        verify(audit, never()).record(eq(AuditAction.DEAL_RISK_APPROVAL_WITHDRAWN), anyString(),
                anyLong(), anyString());
    }

    @Test
    void aDealBeingCreatedHasNoApprovalToWithdrawAndNothingToAuditAgainst() {
        // apply() runs on create before the row exists. Auditing there would record against a
        // null id, and there is nothing that could have been approved yet anyway.
        Deal fresh = new Deal();

        service.apply(fresh);

        assertThat(fresh.isRiskApproved()).isFalse();
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    /* ---------- the audit trail ---------- */

    @Test
    void aTransitionIsAuditedWithItsCauseAndItsScore() {
        withNodes(company("Eriksson Holdings", n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        verify(audit).record(eq(AuditAction.DEAL_RISK_CHANGED), eq("Deal"), eq(DEAL_ID),
                contains("Eriksson Holdings"));
        verify(audit).record(eq(AuditAction.DEAL_RISK_CHANGED), eq("Deal"), eq(DEAL_ID),
                contains("score 6"));
    }

    @Test
    void theAuditLineNamesTheQuestionThatWasActuallyAsked() {
        // "Nominee director/shareholder" on a limited partnership would be a plausible-looking
        // line describing a question nobody put to it.
        withNodes(limitedPartnership(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        verify(audit).record(eq(AuditAction.DEAL_RISK_CHANGED), eq("Deal"), eq(DEAL_ID),
                contains("Nominee limited partner"));
    }

    @Test
    void aRecomputeThatChangesNothingIsNotAudited() {
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.NO)));   // already LOW

        assertThat(service.recomputeFor(DEAL_ID)).isNull();
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    /* ---------- edges ---------- */

    @Test
    void aDealBeingCreatedHasNoStructureToConsult() {
        // apply() runs before the row exists, so the id is null and there is nothing to read.
        Deal fresh = new Deal();
        fresh.setOwnershipTenureYears(10);
        fresh.setFaceToFaceIdVerified(true);
        fresh.setForeignExposureCountry(CountryRisk.NONE);

        service.apply(fresh);

        assertThat(fresh.getRiskRating()).isEqualTo(RiskRating.LOW);
        verify(structures, never()).findByDealId(any());
    }

    @Test
    void aMissingDealIsANoOpRatherThanAnError() {
        // A node write racing a deal deletion must not take the request down with it.
        assertThat(service.recomputeFor(999L)).isNull();
    }

    /* ---------- helpers ---------- */

    private int scoreWithTenure(int years, int months) {
        deal.setOwnershipTenureYears(years);
        deal.setOwnershipTenureMonths(months);
        return service.assess(deal).value();
    }

    /** The score a single node contributes, with the deal answered so it adds nothing. */
    private int scoreOf(OwnershipNode n) {
        return assessWith(n).value();
    }

    private RiskAssessment assessWith(OwnershipNode n) {
        withNodes(n);
        return service.assess(deal);
    }

    private void withNodes(OwnershipNode... all) {
        lenient().when(nodes.findAllByOwnershipStructureIdOrderByIdAsc(STRUCTURE_ID))
                .thenReturn(List.of(all));
    }

    /**
     * Individuals, wired to the person records their countries live on. One call rather than
     * two, because forgetting the second half is how this test would pass while asserting
     * nothing about the country at all.
     */
    private void withPeople(BeneficialOwner... owners) {
        List<OwnershipNode> all = new ArrayList<>();
        for (BeneficialOwner o : owners) {
            all.add(node(NodeType.INDIVIDUAL, "Person " + o.getId(),
                    n -> n.setBeneficialOwnerId(o.getId())));
        }
        withNodes(all.toArray(OwnershipNode[]::new));
        lenient().when(people.findAllById(any())).thenReturn(List.of(owners));
    }

    private BeneficialOwner individual(String countryOfResidence) {
        BeneficialOwner o = new BeneficialOwner();
        ReflectionTestUtils.setField(o, "id", ids.incrementAndGet());
        o.setCountryOfResidence(countryOfResidence);
        return o;
    }

    private OwnershipNode limitedPartnership(Consumer<OwnershipNode> setup) {
        return node(NodeType.LIMITED_PARTNERSHIP, "Eriksson Capital LP", setup);
    }

    private OwnershipNode trust(Consumer<OwnershipNode> setup) {
        return node(NodeType.TRUST, "The Eriksson Family Trust", setup);
    }

    private OwnershipNode company(Consumer<OwnershipNode> setup) {
        return company("A company", setup);
    }

    private OwnershipNode company(String name, Consumer<OwnershipNode> setup) {
        return node(NodeType.PRIVATE_COMPANY, name, setup);
    }

    private OwnershipNode node(NodeType type, String name, Consumer<OwnershipNode> setup) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", ids.incrementAndGet());
        n.setNodeType(type);
        n.setDisplayName(name);
        setup.accept(n);
        return n;
    }
}
