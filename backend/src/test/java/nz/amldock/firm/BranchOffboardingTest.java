package nz.amldock.firm;

import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.user.MembershipService;
import nz.amldock.user.User;
import nz.amldock.user.UserOnboarding;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserService;
import nz.amldock.user.Role;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Deactivating and reactivating a branch: the cascade to its members, and the guards on return. */
@ExtendWith(MockitoExtension.class)
class BranchOffboardingTest {

    static final Long FIRM_ID = 1L;
    static final Long BRANCH_ID = 10L;

    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock UserService userService;
    @Mock UserOnboarding onboarding;
    @Mock MembershipService memberships;

    BranchService service;
    RealEstateFirm firm;
    FirmBranch branch;

    @BeforeEach
    void setUp() {
        FirmService firmService = new FirmService(firms, branches, userService, onboarding);
        service = new BranchService(branches, firms, firmService, memberships, userService);

        firm = new RealEstateFirm();
        ReflectionTestUtils.setField(firm, "id", FIRM_ID);
        firm.setName("Harbour Realty");
        firm.setCountry("NZ");
        branch = new FirmBranch();
        ReflectionTestUtils.setField(branch, "id", BRANCH_ID);
        branch.setRealEstateFirmId(FIRM_ID);
        branch.setName("Ponsonby");
        lenient().when(firms.findById(FIRM_ID)).thenReturn(Optional.of(firm));
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));

        UserPrincipal root = new UserPrincipal(1L, "root@amldock.com", null, Role.ROOT, null, null, true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(root, null, List.of()));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deactivatingSignsOutEveryoneItSwitchedOff() {
        User a = new User();
        User b = new User();
        when(memberships.deactivateInBranch(BRANCH_ID, DeactivationSource.BRANCH)).thenReturn(List.of(a, b));

        service.deactivate(BRANCH_ID, DeactivationSource.MANUAL);

        assertThat(branch.isActive()).isFalse();
        assertThat(branch.getDeactivatedAt()).isNotNull();
        assertThat(branch.getDeactivationSource()).isEqualTo(DeactivationSource.MANUAL);
        verify(userService).endSessions(a);
        verify(userService).endSessions(b);
    }

    @Test
    void deactivatingTwiceKeepsTheFirstCause() {
        branch.deactivate(DeactivationSource.MANUAL);

        service.deactivate(BRANCH_ID, DeactivationSource.FIRM);

        assertThat(branch.getDeactivationSource()).isEqualTo(DeactivationSource.MANUAL);
        verify(memberships, never()).deactivateInBranch(any(), any());
    }

    @Test
    void reactivatingRestoresTheBranchesMembers() {
        branch.deactivate(DeactivationSource.MANUAL);

        service.activate(BRANCH_ID);

        assertThat(branch.isActive()).isTrue();
        assertThat(branch.getDeactivatedAt()).isNull();
        verify(memberships).reactivateInBranch(BRANCH_ID, DeactivationSource.BRANCH);
    }

    @Test
    void notWhileItsEntityIsDeactivated() {
        branch.deactivate(DeactivationSource.FIRM);
        firm.setActive(false);

        assertThatThrownBy(() -> service.activate(BRANCH_ID))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("reactivate the reporting entity first");
        assertThat(branch.isActive()).isFalse();
    }

    @Test
    void norPastTheBranchCountTheEntityDeclares() {
        branch.deactivate(DeactivationSource.MANUAL);
        firm.setNumberOfBranches(2);
        FirmBranch one = new FirmBranch();
        FirmBranch two = new FirmBranch();
        when(branches.findAllByRealEstateFirmIdOrderByNameAsc(FIRM_ID)).thenReturn(List.of(one, two, branch));

        assertThatThrownBy(() -> service.activate(BRANCH_ID))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("declares 2 branch");
    }

    @Test
    void theGuardRefusesWritesToADeactivatedBranch() {
        ScopeStatusGuard guard = new ScopeStatusGuard(branches, firms);
        guard.assertBranchWritable(BRANCH_ID); // active: fine
        guard.assertBranchWritable(null);      // firm-level row: not a branch's concern

        branch.deactivate(DeactivationSource.MANUAL);

        assertThatThrownBy(() -> guard.assertBranchWritable(BRANCH_ID))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Ponsonby is deactivated");
    }
}
