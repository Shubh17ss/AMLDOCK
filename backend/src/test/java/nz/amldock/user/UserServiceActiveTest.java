package nz.amldock.user;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
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
import static org.mockito.Mockito.lenient;

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

    UserService service;

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
        service = new UserService(users, firms, branches, encoder);

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
        return u;
    }

    private static UpdateUserRequest setActive(boolean active) {
        return new UpdateUserRequest(null, null, null, null, null, active);
    }

    /* ---------- the change ---------- */

    @Test
    void aComplianceOfficerMaySuspendAnAgentInTheirOwnFirm() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(amlco, 50L, setActive(false));

        assertThat(agent.isActive()).isFalse();
    }

    @Test
    void andMayRestoreThemAgain() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);
        agent.setActive(false);

        service.update(amlco, 50L, setActive(true));

        assertThat(agent.isActive()).isTrue();
    }

    @Test
    void rootMaySuspendAnyone() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(root, 50L, setActive(false));

        assertThat(agent.isActive()).isFalse();
    }

    /* ---------- the limits ---------- */

    @Test
    void anotherFirmsUserIsOutOfReach() {
        target(50L, Role.AGENT, FIRM_B, BRANCH_20);

        assertThatThrownBy(() -> service.update(amlco, 50L, setActive(false)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not in your firm");
    }

    /** And the reverse, so the check is a firm boundary rather than a fact about firm A. */
    @Test
    void theBoundaryHoldsInBothDirections() {
        target(53L, Role.AGENT, FIRM_A, BRANCH_10);

        assertThatThrownBy(() -> service.update(foreignAmlco, 53L, setActive(false)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not in your firm");
    }

    /**
     * The firm-level peer rule, which is what stops a compliance officer unseating the senior
     * manager who could otherwise reverse them. It predates this change; suspension inherits it
     * because it goes through the same check.
     */
    @Test
    void aFirmLevelPeerCannotBeSuspended() {
        target(51L, Role.SENIOR_MANAGER, FIRM_A, null);

        assertThatThrownBy(() -> service.update(amlco, 51L, setActive(false)))
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

        assertThatThrownBy(() -> service.update(amlco, 2L, setActive(false)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("your own account's status");

        assertThat(self.isActive()).isTrue();
    }

    /** Editing your own name is still fine — the guard is about the status, not the row. */
    @Test
    void youMayStillEditYourOwnName() {
        User self = target(2L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        assertThatCode(() -> service.update(amlco, 2L,
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

        assertThatCode(() -> service.update(amlco, 2L, setActive(true))).doesNotThrowAnyException();

        assertThat(self.isActive()).isTrue();
    }

    /* ---------- branch scope ---------- */

    @Test
    void aSalesManagerMaySuspendAnAgentInTheirOwnBranch() {
        User agent = target(50L, Role.AGENT, FIRM_A, BRANCH_10);

        service.update(salesManager, 50L, setActive(false));

        assertThat(agent.isActive()).isFalse();
    }

    @Test
    void aSalesManagerCannotReachAnotherBranch() {
        target(52L, Role.AGENT, FIRM_A, BRANCH_20);

        assertThatThrownBy(() -> service.update(salesManager, 52L, setActive(false)))
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

        service.update(amlco, 50L,
                new UpdateUserRequest(null, null, Role.SENIOR_MANAGER, FIRM_A, null, null));

        assertThat(agent.getRole()).isEqualTo(Role.AGENT);
    }
}
