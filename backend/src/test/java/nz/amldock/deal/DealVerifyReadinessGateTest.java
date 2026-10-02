package nz.amldock.deal;

import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.deal.readiness.VerificationReadinessService;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
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

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Every way into VERIFIED goes through the readiness check: the verify transition and a senior
 * manager's override alike. The checks themselves are covered in VerificationReadinessServiceTest;
 * this is about where they are enforced.
 */
@ExtendWith(MockitoExtension.class)
class DealVerifyReadinessGateTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 1L;

    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock DealNoteService dealNotes;
    @Mock nz.amldock.audit.AuditService audit;
    @Mock nz.amldock.notification.DealNotificationEnqueuer notifier;
    @Mock nz.amldock.deal.version.DealVersionService versions;
    @Mock VerificationReadinessService readiness;

    DealService service;
    Deal deal;

    final UserPrincipal complianceOfficer = new UserPrincipal(
            5L, "amlco@firm.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_ID, BRANCH_ID, true);
    final UserPrincipal seniorManager = new UserPrincipal(
            6L, "sm@firm.com", null, Role.SENIOR_MANAGER, FIRM_ID, BRANCH_ID, true);
    final UserPrincipal agent = new UserPrincipal(
            7L, "agent@firm.com", null, Role.AGENT, FIRM_ID, BRANCH_ID, true);

    @BeforeEach
    void setUp() {
        service = new DealService(deals, mock(PropertyRepository.class), mock(ClientRepository.class),
                branches, mock(RealEstateFirmRepository.class), mock(UserRepository.class),
                new DealLifecycleService(mock(DealUserRepository.class)), dealNotes,
                mock(BeneficialOwnerService.class), mock(DealRiskService.class),
                mock(nz.amldock.ownership.OwnershipService.class), audit, notifier, versions,
                mock(nz.amldock.deal.sale.DealSaleUnitRepository.class), readiness);

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
        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void anIncompleteDealCannotBeVerified() {
        asUser(complianceOfficer);
        doThrow(new BadRequestException("Please provide all the mandatory information: Risk level approved"))
                .when(readiness).assertReady(deal);

        assertThatThrownBy(() -> service.act(DEAL_ID, DealAction.VERIFY, "All checked"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("mandatory information");
        // Nothing past the gate ran: no snapshot, no timeline entry, no email.
        verify(versions, never()).snapshotIfVerified(any(), any(), any(), any());
        verify(dealNotes, never()).appendTransition(any(), any(), any(), any(), any());
        verify(notifier, never()).enqueueStatusChanged(any(), any(), any());
    }

    @Test
    void aReadyDealIsVerified() {
        asUser(complianceOfficer);

        service.act(DEAL_ID, DealAction.VERIFY, "All checked");

        verify(readiness).assertReady(deal);
        assertThat(deal.getStatus()).isEqualTo(DealStatus.VERIFIED);
    }

    @Test
    void otherTransitionsAreNotChecked() {
        asUser(complianceOfficer);

        service.act(DEAL_ID, DealAction.HOLD, "Waiting on ID");

        verify(readiness, never()).assertReady(any());
    }

    @Test
    void anOverrideIntoVerifiedIsCheckedToo() {
        asUser(seniorManager);
        deal.setStatus(DealStatus.NEW);
        doThrow(new BadRequestException("Please provide all the mandatory information: Ownership structure"))
                .when(readiness).assertReady(deal);

        assertThatThrownBy(() -> service.override(DEAL_ID, DealStatus.VERIFIED, "Forcing it"))
                .isInstanceOf(BadRequestException.class);
        verify(versions, never()).snapshotIfVerified(any(), any(), any(), any());
    }

    @Test
    void someoneWhoMayNotVerifyIsToldThatRatherThanTheGaps() {
        asUser(agent);

        assertThatThrownBy(() -> service.act(DEAL_ID, DealAction.VERIFY, "All checked"))
                .isInstanceOf(ForbiddenException.class);
        verify(readiness, never()).assertReady(any());
    }

    private void asUser(UserPrincipal who) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(who, null, who.getAuthorities()));
    }
}
