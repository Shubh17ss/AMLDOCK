package nz.amldock.audit;

import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The deal audit trail is role-gated at the controller but must also be firm-scoped: without it a
 * compliance officer could read any firm's trail by walking deal ids. Uses the real
 * DealLifecycleService (it is stateless) so the actual guard is exercised, not a stub of it.
 */
@ExtendWith(MockitoExtension.class)
class AuditServiceScopeTest {

    @Mock AuditLogRepository repo;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;

    AuditService service;

    // Firm 1's compliance officer. Deal 500 lives in branch 10, which belongs to firm 2.
    final UserPrincipal firmOneOfficer =
            new UserPrincipal(7L, "co@firm1.com", null, Role.AML_COMPLIANCE_OFFICER, 1L, null, true);

    @BeforeEach
    void setUp() {
        service = new AuditService(repo, deals, branches, new DealLifecycleService());
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAs(UserPrincipal principal) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    /** Deal 500 sits in branch 10, owned by the given firm. */
    private void stubDealInFirm(Long firmId) {
        Deal deal = new Deal();
        deal.setFirmBranchId(10L);
        deal.setCreatedByUserId(42L);
        lenient().when(deals.findById(500L)).thenReturn(Optional.of(deal));

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(firmId);
        lenient().when(branches.findById(10L)).thenReturn(Optional.of(branch));
    }

    @Test
    void refusesAnotherFirmsDealTrail() {
        stubDealInFirm(2L); // the deal belongs to firm 2
        authenticateAs(firmOneOfficer);

        assertThatThrownBy(() -> service.listForDeal(500L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Not your firm's deal");

        // The trail must not be queried at all once scope fails.
        verify(repo, never()).findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Deal", 500L);
    }

    @Test
    void allowsOwnFirmsDealTrail() {
        stubDealInFirm(1L); // same firm as the officer
        authenticateAs(firmOneOfficer);
        when(repo.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Deal", 500L))
                .thenReturn(List.of());

        assertThat(service.listForDeal(500L)).isEmpty();
        verify(repo).findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Deal", 500L);
    }

    @Test
    void rootReadsAnyFirmsDealTrail() {
        stubDealInFirm(2L);
        authenticateAs(new UserPrincipal(1L, "root@amldock.nz", null, Role.ROOT, null, null, true));
        when(repo.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Deal", 500L))
                .thenReturn(List.of());

        assertThat(service.listForDeal(500L)).isEmpty();
    }
}
