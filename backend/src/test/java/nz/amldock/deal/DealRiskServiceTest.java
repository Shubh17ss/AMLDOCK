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
import nz.amldock.ownership.TrustType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

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
 * The deal's risk rule, now that the ownership structure feeds it.
 *
 * <p>The cases worth pinning are the ones where two inputs interact: a node raising the rating
 * while the deal's own answer says LOW, and a node lowering its answer while the deal's own
 * answer still says HIGH. Getting either wrong produces a rating that cannot be reconciled
 * against what is on screen, which is the whole reason this is derived server-side.
 */
@ExtendWith(MockitoExtension.class)
class DealRiskServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long STRUCTURE_ID = 20L;

    @Mock DealRepository deals;
    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodes;
    @Mock AuditService audit;

    DealRiskService service;
    Deal deal;

    @BeforeEach
    void setUp() {
        service = new DealRiskService(deals, structures, nodes, audit);

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setRiskRating(RiskRating.LOW);

        OwnershipStructure structure = new OwnershipStructure();
        ReflectionTestUtils.setField(structure, "id", STRUCTURE_ID);
        structure.setDealId(DEAL_ID);

        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.of(structure));
        lenient().when(nodes.findAllByOwnershipStructureIdOrderByIdAsc(STRUCTURE_ID))
                .thenReturn(List.of());
    }

    /* ---------- the two node answers ---------- */

    @Test
    void aNomineeDirectorRaisesTheDealToHigh() {
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    @Test
    void aComplexOwnershipStructureRaisesTheDealToHigh() {
        withNodes(company(n -> n.setCompanyComplexOwnership(true)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    @Test
    void notAskedIsNotAYes() {
        // The default state of the nominee question. Treating it as YES would raise every
        // company ever added; treating it as NO is what the user asked for.
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.NOT_ASKED)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    @Test
    void anUnansweredComplexOwnershipQuestionIsNotRisk() {
        // Stored nullable so an untouched row does not read as answers nobody gave. An
        // unanswered question is not evidence of anything, least of all of risk.
        withNodes(company(n -> n.setCompanyComplexOwnership(null)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    /* ---------- the trust answer (V36) ---------- */

    @Test
    void anExtensiveOrDiversePortfolioRaisesTheDealToHigh() {
        withNodes(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.EXTENSIVE_DIVERSE_PORTFOLIO)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    @Test
    void theSmallerHoldingBandsDoNot() {
        // A trust holding the family home is the ordinary case, not a finding.
        withNodes(trust(n -> n.setTrustHoldingComplexity(
                TrustHoldingComplexity.MORE_THAN_ONE_PROPERTY_ASSET)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    @Test
    void theTrustTypeItselfDoesNotMoveTheRating() {
        // Risk-relevant to a reviewer, but not a rule. An asset protection trust holding one
        // house is not automatically high risk, and pretending otherwise would flag most of
        // the book.
        withNodes(trust(n -> {
            n.setTrustType(TrustType.ASSET_PROTECTION);
            n.setTrustDiscretionary(true);
            n.setTrustHoldingComplexity(TrustHoldingComplexity.SINGLE_PROPERTY_ASSET);
        }));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    @Test
    void aTrustAndACompanyBothRaisingItIsStillJustHigh() {
        // Two reasons, one rating. The audit line names the first; the rating is not doubled.
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.YES)),
                trust(n -> n.setTrustHoldingComplexity(
                        TrustHoldingComplexity.EXTENSIVE_DIVERSE_PORTFOLIO)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    /* ---------- the same question, asked of a limited partnership (V37) ---------- */

    @Test
    void aNomineeLimitedPartnerRaisesTheDealToHigh() {
        // One column, two questions. A limited partnership is asked about a nominee limited
        // partner rather than a nominee director, and the consequence is identical.
        withNodes(limitedPartnership(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    @Test
    void theAuditLineNamesTheQuestionThatWasActuallyAsked() {
        // "Nominee director/shareholder" on a limited partnership would be a plausible-looking
        // line describing a question nobody put to it.
        withNodes(limitedPartnership(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        verify(audit).record(eq(AuditAction.DEAL_RISK_CHANGED), eq("Deal"), eq(DEAL_ID),
                contains("nominee limited partner"));
    }

    /* ---------- it recomputes rather than latches ---------- */

    @Test
    void changingTheAnswerBackDropsTheRating() {
        deal.setRiskRating(RiskRating.HIGH);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.NO)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    @Test
    void oneInputClearingDoesNotClearAnother() {
        // The deal's own answer still says HIGH. A node answering "no" is not a statement about
        // how quickly the property was on-sold.
        deal.setOnSoldQuickly(true);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.NO)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    @Test
    void aRatingPinnedByComplianceIsLeftAlone() {
        deal.setRiskRatingSource(RiskRatingSource.OVERRIDE);
        deal.setRiskRating(RiskRating.LOW);
        withNodes(company(n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        assertThat(deal.getRiskRating()).isEqualTo(RiskRating.LOW);
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    /* ---------- the audit trail ---------- */

    @Test
    void aTransitionIsAuditedWithItsCause() {
        // A rating that moves with no deal edit behind it is exactly what an auditor asks about.
        withNodes(company("Eriksson Holdings", n -> n.setNomineeStatus(NomineeStatus.YES)));

        service.recomputeFor(DEAL_ID);

        verify(audit).record(eq(AuditAction.DEAL_RISK_CHANGED), eq("Deal"), eq(DEAL_ID),
                contains("Eriksson Holdings"));
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
        fresh.setOnSoldQuickly(false);

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

    private void withNodes(OwnershipNode... all) {
        lenient().when(nodes.findAllByOwnershipStructureIdOrderByIdAsc(STRUCTURE_ID))
                .thenReturn(List.of(all));
    }

    private static OwnershipNode limitedPartnership(java.util.function.Consumer<OwnershipNode> setup) {
        OwnershipNode n = new OwnershipNode();
        n.setNodeType(NodeType.LIMITED_PARTNERSHIP);
        n.setDisplayName("Eriksson Capital LP");
        setup.accept(n);
        return n;
    }

    private static OwnershipNode trust(java.util.function.Consumer<OwnershipNode> setup) {
        OwnershipNode n = new OwnershipNode();
        n.setNodeType(NodeType.TRUST);
        n.setDisplayName("The Eriksson Family Trust");
        setup.accept(n);
        return n;
    }

    private static OwnershipNode company(java.util.function.Consumer<OwnershipNode> setup) {
        return company("A company", setup);
    }

    private static OwnershipNode company(String name, java.util.function.Consumer<OwnershipNode> setup) {
        OwnershipNode n = new OwnershipNode();
        n.setNodeType(NodeType.PRIVATE_COMPANY);
        n.setDisplayName(name);
        setup.accept(n);
        return n;
    }
}
