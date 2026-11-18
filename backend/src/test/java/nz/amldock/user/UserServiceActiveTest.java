package nz.amldock.user;

import nz.amldock.auth.RefreshTokenRepository;
import nz.amldock.auth.TokenStateCache;
import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.DeactivationSource;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.dto.UpdateUserRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Who may switch an account off.
 *
 * <p>It used to be ROOT alone, which left the compliance officers who create a firm's accounts
 * unable to suspend one — an account stayed live until a platform administrator got to it. The
 * authority now follows {@code assertCanManage}: suspending is the same authority as creating, so
 * it answers to the same check rather than a second rule that could disagree with it.
 *
 * <p>Also the first coverage of {@code assertCanManage} itself, which had none.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceActiveTest {

    static final Long FIRM_A = 1L;
    static final Long FIRM_B = 2L;
    static final Long BRANCH_10 = 10L;
    static final Long BRANCH_20 = 20L;

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock PasswordEncoder encoder;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock TokenStateCache tokenStates;

    UserService service;
    MembershipFixture memberships;

    final UserPrincipal root =
            new UserPrincipal(1L, "root@amldock.com", null, Role.ROOT, null, null, true);
    final UserPrincipal amlco =
            new UserPrincipal(2L, "amlco@a.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null, true);
    final UserPrincipal foreignAmlco =
            new UserPrincipal(3L, "amlco@b.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, true);
    final UserPrincipal salesManager =
            new UserPrincipal(4L, "sm@a.com", null, Role.SALES_MANAGER, FIRM_A, BRANCH_10, true);

    @BeforeEach
    void setUp() {
        memberships = new MembershipFixture();
        service = new UserService(users, firms, branches, encoder, refreshTokens, tokenStates,
                memberships.repo, new MembershipService(memberships.repo, users, firms));

        // update() finishes with validateFirmLinkage, which re-checks that the firm and branch on
        // the row still exist and are active — it runs whatever field was actually changed.
        for (Long firmId : new Long[]{FIRM_A, FIRM_B}) {
            RealEstateFirm firm = new RealEstateFirm();
            firm.setActive(true);
            lenient().when(firms.findById(firmId)).thenReturn(Optional.of(firm));
        }
        lenient().when(branches.findById(BRANCH_10)).thenReturn(Optional.of(branchIn(FIRM_A)));
        lenient().when(branches.findById(BRANCH_20)).thenReturn(Optional.of(branchIn(FIRM_A)));
    }

    private static FirmBranch branchIn(Long firmId) {
        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(firmId);
        branch.setActive(true);
        return branch;
    }

    /** A target user, registered with the repository so `update` can find it. */
    private User target(Long id, Role role, Long firmId, Long branchId) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setEmail("target" + id + "@x.com");
        u.setFullName("Target " + id);
        u.setRole(role);
        u.setRealEstateFirmId(firmId);
        u.setFirmBranchId(branchId);
        u.setActive(true);
        lenient().when(users.findById(id)).thenReturn(Optional.of(u));
        memberships.addHome(u);
        return u;
    }

    /** Switched off in their entity, as a deactivation leaves them. */
    private void deactivate(User u) {
        memberships.in(u.getId(), u.getRealEstateFirmId()).orElseThrow().setActive(false);
        u.setActive(false);
    }

    private static UpdateUserRequest setActive(boolean active) {
        return new UpdateUserRequest(null, null, null, null, null, active);
    }

    /* ---------- the change ---------- */

    @Test
    void aComplianceOfficerMaySuspendAnAgentInTheirOwnFirm() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(amlco, 50L, null, setActive(false));

        assertThat(agent.isActive()).isFalse();
    }

    @Test
    void andMayRestoreThemAgain() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);
        deactivate(agent);

        service.update(amlco, 50L, null, setActive(true));

        assertThat(agent.isActive()).isTrue();
    }

    @Test
    void rootMaySuspendAnyone() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(root, 50L, null, setActive(false));

        assertThat(agent.isActive()).isFalse();
    }

    /* ---------- the limits ---------- */

    /**
     * Another entity's user is not a member of this one, so from here there is nobody to update —
     * a 404, as the single-user read gives, rather than a 403 that would confirm the id exists.
     */
    @Test
    void anotherFirmsUserIsOutOfReach() {
        target(50L, Role.AGENT, FIRM_B, BRANCH_20);

        assertThatThrownBy(() -> service.update(amlco, 50L, null, setActive(false)))
                .isInstanceOf(NotFoundException.class);
    }

    /** And the reverse, so the check is a firm boundary rather than a fact about firm A. */
    @Test
    void theBoundaryHoldsInBothDirections() {
        target(53L, Role.AGENT, FIRM_A, BRANCH_10);

        assertThatThrownBy(() -> service.update(foreignAmlco, 53L, null, setActive(false)))
                .isInstanceOf(NotFoundException.class);
    }

    /**
     * The firm-level peer rule, which is what stops a compliance officer unseating the senior
     * manager who could otherwise reverse them. It predates this change; suspension inherits it
     * because it goes through the same check.
     */
    @Test
    void aFirmLevelPeerCannotBeSuspended() {
        target(51L, Role.SENIOR_MANAGER, FIRM_A, null);

        assertThatThrownBy(() -> service.update(amlco, 51L, null, setActive(false)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("can't be edited or deleted");
    }

    /**
     * The one guard suspension needed that editing did not. {@code assertCanManage} deliberately
     * lets an actor act on themselves so a manager can fix their own name — applied to this, it
     * would let a firm's only compliance officer switch off the account nobody else can switch on.
     */
    @Test
    void nobodyMaySuspendTheirOwnAccount() {
        User self = target(2L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        assertThatThrownBy(() -> service.update(amlco, 2L, null, setActive(false)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("your own account's status");

        assertThat(self.isActive()).isTrue();
    }

    /** Editing your own name is still fine — the guard is about the status, not the row. */
    @Test
    void youMayStillEditYourOwnName() {
        User self = target(2L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        assertThatCode(() -> service.update(amlco, 2L, null,
                new UpdateUserRequest("New Name", null, null, null, null, null)))
                .doesNotThrowAnyException();

        assertThat(self.getFullName()).isEqualTo("New Name");
    }

    /**
     * A no-op passes rather than throwing. The frontend sends the whole row on some paths, so a
     * self-edit that merely restates `active: true` must not be read as an attempted suspension.
     */
    @Test
    void restatingYourOwnCurrentStatusIsNotASuspension() {
        User self = target(2L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        assertThatCode(() -> service.update(amlco, 2L, null, setActive(true))).doesNotThrowAnyException();

        assertThat(self.isActive()).isTrue();
    }

    /* ---------- branch scope ---------- */

    /** Off-boarding is for root, the compliance officer and the senior manager. */
    @Test
    void aSalesManagerCannotSuspendEvenInTheirOwnBranch() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        assertThatThrownBy(() -> service.update(salesManager, 50L, null, setActive(false)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("activate or deactivate");
        assertThat(agent.isActive()).isTrue();
    }

    @Test
    void norRestoreThem() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);
        deactivate(agent);

        assertThatThrownBy(() -> service.update(salesManager, 50L, null, setActive(true)))
                .isInstanceOf(ForbiddenException.class);
        assertThat(agent.isActive()).isFalse();
    }

    @Test
    void norDeleteThem() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        assertThatThrownBy(() -> service.delete(salesManager, 50L, null))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("delete users");
        verify(users, org.mockito.Mockito.never()).delete(agent);
    }

    @Test
    void aSalesManagerMayStillEditTheirAgentsName() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(salesManager, 50L, null,
                new UpdateUserRequest("New Name", null, null, null, null, null));

        assertThat(agent.getFullName()).isEqualTo("New Name");
    }

    /* ---------- deactivated scope ---------- */

    @Test
    void nobodyIsRestoredInsideADeactivatedBranch() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);
        deactivate(agent);
        FirmBranch closed = branchIn(FIRM_A);
        closed.setName("Ponsonby");
        closed.setActive(false);
        lenient().when(branches.findById(BRANCH_10)).thenReturn(Optional.of(closed));

        assertThatThrownBy(() -> service.update(root, 50L, FIRM_A, setActive(true)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("reactivate the branch");
        assertThat(agent.isActive()).isFalse();
    }

    @Test
    void norInsideADeactivatedEntity() {
        User officer = target(51L, Role.SENIOR_MANAGER, FIRM_A, null);
        deactivate(officer);
        RealEstateFirm closed = new RealEstateFirm();
        closed.setName("Harbour Realty");
        closed.setActive(false);
        lenient().when(firms.findById(FIRM_A)).thenReturn(Optional.of(closed));

        assertThatThrownBy(() -> service.update(root, 51L, FIRM_A, setActive(true)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("reactivate the reporting entity");
    }

    @Test
    void suspendingByHandIsRecordedAsManual() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(amlco, 50L, null, setActive(false));

        assertThat(memberships.in(agent.getId(), FIRM_A).orElseThrow().getDeactivationSource())
                .isEqualTo(DeactivationSource.MANUAL);
    }

    @Test
    void aSalesManagerCannotReachAnotherBranch() {
        target(52L, Role.AGENT, FIRM_A, BRANCH_20);

        assertThatThrownBy(() -> service.update(salesManager, 52L, null, setActive(false)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not in your branch");
    }

    /* ---------- what stays ROOT-only ---------- */

    /**
     * Widening `active` must not have widened anything beside it. Role, firm and branch decide what
     * a user *is* and which reporting entity they answer to, which is still not a firm manager's
     * call — and the silent-ignore is the pre-existing behaviour for those fields.
     */
    @Test
    void aComplianceOfficerStillCannotChangeARole() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(amlco, 50L, null,
                new UpdateUserRequest(null, null, Role.SENIOR_MANAGER, FIRM_A, null, null));

        assertThat(agent.getRole()).isEqualTo(Role.AGENT);
        // Nothing an access token claims has changed, so nobody is signed out.
        assertThat(agent.getTokenVersion()).isZero();
        verifyNoInteractions(refreshTokens, tokenStates);
    }

    /* ---------- F6: a change to someone's access ends their sessions at once ---------- */

    @Test
    void suspendingEndsTheUsersSessions() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(amlco, 50L, null, setActive(false));

        assertThat(agent.getTokenVersion()).isEqualTo(1);
        verify(refreshTokens).revokeAllForUser(eq(50L), any());
        verify(tokenStates).evictAfterCommit(50L);
    }

    @Test
    void reactivatingDoesNot() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);
        deactivate(agent);

        service.update(amlco, 50L, null, setActive(true));

        assertThat(agent.getTokenVersion()).isZero();
        verifyNoInteractions(refreshTokens, tokenStates);
    }

    @Test
    void aRoleChangeEndsTheUsersSessions() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(root, 50L, null, new UpdateUserRequest(null, null, Role.ADMIN, FIRM_A, BRANCH_10, null));

        assertThat(agent.getRole()).isEqualTo(Role.ADMIN);
        assertThat(agent.getTokenVersion()).isEqualTo(1);
        verify(refreshTokens).revokeAllForUser(eq(50L), any());
    }

    @Test
    void aBranchMoveEndsTheUsersSessions() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(root, 50L, null, new UpdateUserRequest(null, null, null, null, BRANCH_20, null));

        assertThat(agent.getFirmBranchId()).isEqualTo(BRANCH_20);
        assertThat(agent.getTokenVersion()).isEqualTo(1);
    }

    @Test
    void aNameChangeDoesNot() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(amlco, 50L, null, new UpdateUserRequest("Renamed", null, null, null, null, null));

        assertThat(agent.getTokenVersion()).isZero();
        verifyNoInteractions(refreshTokens, tokenStates);
    }
}
