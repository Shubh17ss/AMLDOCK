package nz.amldock.deal;

import nz.amldock.audit.AuditAction;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.deal.dto.RiskAssessmentDto;
import nz.amldock.dealnote.DealNoteRepository;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.document.DocumentRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.property.PropertyRepository;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Approving a risk, and pinning one by hand.
 *
 * <p>Three rules are worth holding here because each of them is a thing the UI merely asks for
 * politely and the server has to actually enforce: approval is refused while a contributing
 * question is unanswered, an override withdraws an approval, and choosing the calculated band is
 * how an override is released — without that last one a deal would carry a pin forever.
 */
@ExtendWith(MockitoExtension.class)
class DealRiskApprovalTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 1L;

    @Mock DealRepository deals;
    @Mock PropertyRepository properties;
    @Mock ClientRepository clients;
    @Mock FirmBranchRepository branches;
    @Mock RealEstateFirmRepository firms;
    @Mock UserRepository users;
    @Mock DealNoteRepository dealNotes;
    @Mock DocumentRepository documents;
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock BeneficialOwnerRepository people;
    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodes;
    @Mock nz.amldock.audit.AuditService audit;
    @Mock nz.amldock.ownership.OwnershipService ownership;
    @Mock nz.amldock.notification.DealNotificationEnqueuer notifier;
    @Mock nz.amldock.deal.version.DealVersionService versions;

    DealService service;
    Deal deal;

    final UserPrincipal complianceOfficer = new UserPrincipal(
            5L, "amlco@firm.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_ID, BRANCH_ID, true);
    final UserPrincipal agent = new UserPrincipal(
            7L, "agent@firm.com", null, Role.AGENT, FIRM_ID, BRANCH_ID, true);

    @BeforeEach
    void setUp() {
        service = new DealService(deals, properties, clients, branches, firms, users,
                new DealLifecycleService(mock(DealUserRepository.class)),
                new DealNoteService(dealNotes, documents, users),
                beneficialOwners, new DealRiskService(deals, structures, nodes, people, audit),
                ownership, audit, notifier, versions);

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);
        branch.setActive(true);
        ReflectionTestUtils.setField(branch, "id", BRANCH_ID);
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setReference("DEAL-2026-0001");
        deal.setStatus(DealStatus.REVIEW);
        deal.setFirmBranchId(BRANCH_ID);
        deal.setCreatedByUserId(agent.id());
        deal.setRiskRating(RiskRating.LOW);
        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));

        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.empty());
        lenient().when(people.findAllById(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());

        asUser(complianceOfficer);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- approval ---------- */

    @Test
    void approvalIsRefusedWhileAnythingIsUnanswered() {
        // Nothing answered at all: three deal-level questions outstanding.
        assertThatThrownBy(() -> service.approveRisk(DEAL_ID))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("3 still outstanding");

        assertThat(deal.isRiskApproved()).isFalse();
    }

    @Test
    void aFullyAnsweredDealCanBeApproved() {
        answerEverything();

        RiskAssessmentDto dto = service.approveRisk(DEAL_ID);

        assertThat(dto.approved()).isTrue();
        assertThat(dto.complete()).isTrue();
        assertThat(deal.isRiskApproved()).isTrue();
        assertThat(deal.getRiskApprovedByUserId()).isEqualTo(complianceOfficer.id());
        assertThat(deal.getRiskApprovedAt()).isNotNull();
        verify(audit).record(eq(AuditAction.DEAL_RISK_APPROVED), eq("Deal"), eq(DEAL_ID),
                anyString());
    }

    @Test
    void anAgentMayNotApproveARisk() {
        answerEverything();
        asUser(agent);

        assertThatThrownBy(() -> service.approveRisk(DEAL_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    /* ---------- overriding ---------- */

    @Test
    void anOverridePinsTheBandAndRecordsWhy() {
        answerEverything();   // scores 0, so the calculated band is LOW

        RiskAssessmentDto dto = service.overrideRisk(DEAL_ID, RiskRating.HIGH, "Known PEP");

        assertThat(dto.rating()).isEqualTo(RiskRating.HIGH);
        assertThat(dto.calculatedRating()).isEqualTo(RiskRating.LOW);
        assertThat(dto.source()).isEqualTo(RiskRatingSource.OVERRIDE);
        assertThat(dto.overrideComment()).isEqualTo("Known PEP");
        verify(audit).record(eq(AuditAction.DEAL_RISK_OVERRIDDEN), eq("Deal"), eq(DEAL_ID),
                contains("Known PEP"));
    }

    @Test
    void anOverrideWithdrawsAnApproval() {
        answerEverything();
        service.approveRisk(DEAL_ID);
        assertThat(deal.isRiskApproved()).isTrue();

        service.overrideRisk(DEAL_ID, RiskRating.HIGH, "Known PEP");

        assertThat(deal.isRiskApproved()).isFalse();
        assertThat(deal.getRiskApprovedByUserId()).isNull();
        assertThat(deal.getRiskApprovedAt()).isNull();
    }

    @Test
    void choosingTheCalculatedBandReleasesTheOverride() {
        // Otherwise there is no way back to DERIVED, and a deal would carry a pin long after the
        // answers underneath had caught up with it.
        answerEverything();
        service.overrideRisk(DEAL_ID, RiskRating.HIGH, "Known PEP");

        RiskAssessmentDto dto = service.overrideRisk(DEAL_ID, RiskRating.LOW, "PEP check cleared");

        assertThat(dto.source()).isEqualTo(RiskRatingSource.DERIVED);
        assertThat(dto.rating()).isEqualTo(RiskRating.LOW);
        assertThat(dto.overrideComment()).isNull();
        verify(audit).record(eq(AuditAction.DEAL_RISK_OVERRIDDEN), eq("Deal"), eq(DEAL_ID),
                contains("lifted"));
    }

    @Test
    void anAgentMayNotOverrideARisk() {
        asUser(agent);

        assertThatThrownBy(() -> service.overrideRisk(DEAL_ID, RiskRating.HIGH, "Because"))
                .isInstanceOf(ForbiddenException.class);
        verify(audit, org.mockito.Mockito.never())
                .record(eq(AuditAction.DEAL_RISK_OVERRIDDEN), anyString(), anyLong(), anyString());
    }

    /* ---------- reading ---------- */

    @Test
    void theAgentWhoOwnsTheDealMayStillReadItsWorkings() {
        // The workings are the part worth showing widely — a rating nobody outside compliance
        // can account for is the thing this replaced.
        asUser(agent);

        RiskAssessmentDto dto = service.risk(DEAL_ID);

        assertThat(dto.dealId()).isEqualTo(DEAL_ID);
        assertThat(dto.unanswered()).hasSize(3);
        assertThat(dto.complete()).isFalse();
    }

    /* ---------- helpers ---------- */

    /** The three deal-level questions, answered so that nothing scores and nothing is missing. */
    private void answerEverything() {
        deal.setOwnershipTenureYears(10);
        deal.setOwnershipTenureMonths(0);
        deal.setFaceToFaceIdVerified(true);
        deal.setForeignExposureCountry(CountryRisk.NONE);
    }

    private void asUser(UserPrincipal who) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(who, null, who.getAuthorities()));
    }
}
