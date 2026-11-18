package nz.amldock.user;

import nz.amldock.firm.DeactivationSource;
import nz.amldock.firm.RealEstateFirmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

/**
 * A branch going off takes its members with it, and coming back restores exactly those —
 * not anyone a manager had already switched off by hand.
 */
@ExtendWith(MockitoExtension.class)
class MembershipBranchCascadeTest {

    static final Long FIRM_A = 1L;
    static final Long FIRM_B = 2L;
    static final Long BRANCH = 10L;
    static final Long OTHER_BRANCH = 11L;

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;

    MembershipFixture rows;
    MembershipService service;

    @BeforeEach
    void setUp() {
        rows = new MembershipFixture();
        service = new MembershipService(rows.repo, users, firms);
    }

    private User account(Long id, Role role, Long firmId, Long branchId, boolean active) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setEmail("user" + id + "@x.com");
        u.setRole(role);
        u.setRealEstateFirmId(firmId);
        u.setFirmBranchId(branchId);
        u.setActive(active);
        rows.addHome(u);
        lenient().when(users.findByIdForUpdate(id)).thenReturn(Optional.of(u));
        return u;
    }

    private FirmMembership membership(Long userId, Long firmId) {
        return rows.in(userId, firmId).orElseThrow();
    }

    @Test
    void deactivatingSwitchesOffEveryActiveMemberAndSaysWhy() {
        User agent = account(5L, Role.AGENT, FIRM_A, BRANCH, true);
        User admin = account(6L, Role.ADMIN, FIRM_A, BRANCH, true);
        User elsewhere = account(7L, Role.AGENT, FIRM_A, OTHER_BRANCH, true);

        List<User> touched = service.deactivateInBranch(BRANCH, DeactivationSource.BRANCH);

        assertThat(touched).containsExactly(agent, admin);
        assertThat(agent.isActive()).isFalse();
        assertThat(admin.isActive()).isFalse();
        assertThat(membership(5L, FIRM_A).getDeactivationSource()).isEqualTo(DeactivationSource.BRANCH);
        assertThat(elsewhere.isActive()).isTrue();
    }

    @Test
    void someoneAlreadyOffIsNotTouchedOrReCaused() {
        account(5L, Role.AGENT, FIRM_A, BRANCH, true);
        membership(5L, FIRM_A).setActive(false); // a manager switched them off by hand

        List<User> touched = service.deactivateInBranch(BRANCH, DeactivationSource.BRANCH);

        assertThat(touched).isEmpty();
        assertThat(membership(5L, FIRM_A).getDeactivationSource()).isEqualTo(DeactivationSource.MANUAL);
    }

    @Test
    void reactivatingRestoresOnlyWhatTheBranchSwitchedOff() {
        User cascaded = account(5L, Role.AGENT, FIRM_A, BRANCH, true);
        User byHand = account(6L, Role.AGENT, FIRM_A, BRANCH, true);
        membership(6L, FIRM_A).setActive(false);
        byHand.setActive(false);
        service.deactivateInBranch(BRANCH, DeactivationSource.BRANCH);

        int restored = service.reactivateInBranch(BRANCH, DeactivationSource.BRANCH);

        assertThat(restored).isEqualTo(1);
        assertThat(cascaded.isActive()).isTrue();
        assertThat(membership(5L, FIRM_A).getDeactivationSource()).isNull();
        assertThat(byHand.isActive()).isFalse();
        assertThat(membership(6L, FIRM_A).getDeactivationSource()).isEqualTo(DeactivationSource.MANUAL);
    }

    /**
     * An agent may be active in one entity only. Moved to another while their old branch was
     * closed, they stay where they are now; the old membership waits, still marked.
     */
    @Test
    void reactivatingDoesNotUnseatSomeoneNowActiveElsewhere() {
        User agent = account(5L, Role.AGENT, FIRM_A, BRANCH, true);
        service.deactivateInBranch(BRANCH, DeactivationSource.BRANCH);
        rows.add(5L, Role.AGENT, FIRM_B, 20L, true);
        agent.setActive(true);

        int restored = service.reactivateInBranch(BRANCH, DeactivationSource.BRANCH);

        assertThat(restored).isZero();
        assertThat(membership(5L, FIRM_A).isActive()).isFalse();
        assertThat(membership(5L, FIRM_A).getDeactivationSource()).isEqualTo(DeactivationSource.BRANCH);
        assertThat(membership(5L, FIRM_B).isActive()).isTrue();
    }
}
