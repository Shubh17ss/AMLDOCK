package nz.amldock.user;

import nz.amldock.common.exception.ApiException;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;

/**
 * The membership rule: several active entities only for compliance officers and senior managers,
 * one for everyone else — and the account row kept in step with whichever are active.
 */
@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {

    static final Long FIRM_A = 1L;
    static final Long FIRM_B = 2L;
    static final Long BRANCH_A = 10L;
    static final Long BRANCH_B = 20L;

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;

    MembershipFixture rows;
    MembershipService service;

    @BeforeEach
    void setUp() {
        rows = new MembershipFixture();
        service = new MembershipService(rows.repo, users, firms);
        RealEstateFirm a = new RealEstateFirm();
        a.setName("Entity A");
        lenient().when(firms.findById(FIRM_A)).thenReturn(Optional.of(a));
        RealEstateFirm b = new RealEstateFirm();
        b.setName("Entity B");
        lenient().when(firms.findById(FIRM_B)).thenReturn(Optional.of(b));
    }

    private User account(Long id, Role role, Long firmId, Long branchId) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setEmail("user" + id + "@x.com");
        u.setRole(role);
        u.setRealEstateFirmId(firmId);
        u.setFirmBranchId(branchId);
        u.setActive(true);
        rows.addHome(u);
        return u;
    }

    /* ---------- who may be in several ---------- */

    @Test
    void aComplianceOfficerJoinsASecondEntityAndKeepsTheFirst() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        MembershipService.Joined joined = service.join(u, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, false);

        assertThat(joined.existed()).isFalse();
        assertThat(service.activeOf(5L)).extracting(FirmMembership::getRealEstateFirmId)
                .containsExactly(FIRM_A, FIRM_B);
        // The home doesn't move: the next sign-in still starts where they were.
        assertThat(u.getRealEstateFirmId()).isEqualTo(FIRM_A);
    }

    @Test
    void theRoleMayDifferBetweenEntities() {
        User u = account(5L, Role.SENIOR_MANAGER, FIRM_A, null);

        service.join(u, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, false);

        assertThat(service.activeIn(5L, FIRM_A)).get().extracting(FirmMembership::getRole)
                .isEqualTo(Role.SENIOR_MANAGER);
        assertThat(service.activeIn(5L, FIRM_B)).get().extracting(FirmMembership::getRole)
                .isEqualTo(Role.AML_COMPLIANCE_OFFICER);
    }

    @Test
    void anActiveAgentCannotBeAddedElsewhere() {
        User u = account(6L, Role.AGENT, FIRM_A, BRANCH_A);

        assertThatThrownBy(() -> service.join(u, Role.AGENT, FIRM_B, BRANCH_B, false))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("another reporting entity")
                .hasMessageContaining("Deactivate them there");
        assertThat(rows.in(6L, FIRM_B)).isEmpty();
    }

    /** Officer in A cannot also be an agent in B: the exemption needs firm-level on both sides. */
    @Test
    void anOfficerCannotAlsoBeBranchStaffElsewhere() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        assertThatThrownBy(() -> service.join(u, Role.AGENT, FIRM_B, BRANCH_B, false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Deactivate them there");
    }

    @Test
    void anActiveAgentCannotBecomeAnOfficerElsewhereEither() {
        User u = account(6L, Role.AGENT, FIRM_A, BRANCH_A);

        assertThatThrownBy(() -> service.join(u, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Only compliance officers and senior managers");
    }

    /** Naming the other entity is ROOT's privilege; a firm's officer learns only that there is one. */
    @Test
    void theRefusalNamesTheOtherEntityOnlyWhenAllowedTo() {
        User u = account(6L, Role.AGENT, FIRM_A, BRANCH_A);

        assertThatThrownBy(() -> service.join(u, Role.AGENT, FIRM_B, BRANCH_B, true))
                .hasMessageContaining("Entity A");
        assertThatThrownBy(() -> service.join(u, Role.AGENT, FIRM_B, BRANCH_B, false))
                .hasMessageNotContaining("Entity A");
    }

    /* ---------- moving someone ---------- */

    @Test
    void onceSwitchedOffTheyMayBeAddedElsewhere_andTheOldRowStays() {
        User u = account(6L, Role.AGENT, FIRM_A, BRANCH_A);
        service.setActive(u, rows.in(6L, FIRM_A).orElseThrow(), false, false);
        assertThat(u.isActive()).isFalse();

        service.join(u, Role.AGENT, FIRM_B, BRANCH_B, false);

        assertThat(rows.in(6L, FIRM_A)).get().extracting(FirmMembership::isActive).isEqualTo(false);
        assertThat(rows.in(6L, FIRM_B)).get().extracting(FirmMembership::isActive).isEqualTo(true);
        // The account is live again, and its home follows them to where they are active.
        assertThat(u.isActive()).isTrue();
        assertThat(u.getRealEstateFirmId()).isEqualTo(FIRM_B);
        assertThat(u.getFirmBranchId()).isEqualTo(BRANCH_B);
    }

    @Test
    void rejoiningAnOldEntityReactivatesItsRowRatherThanAddingOne() {
        User u = account(6L, Role.AGENT, FIRM_A, BRANCH_A);
        FirmMembership old = rows.in(6L, FIRM_A).orElseThrow();
        service.setActive(u, old, false, false);

        MembershipService.Joined joined = service.join(u, Role.SALES_MANAGER, FIRM_A, BRANCH_A, false);

        assertThat(joined.existed()).isTrue();
        assertThat(joined.membership()).isSameAs(old);
        assertThat(old.isActive()).isTrue();
        assertThat(old.getRole()).isEqualTo(Role.SALES_MANAGER);
        assertThat(rows.all()).hasSize(1);
    }

    @Test
    void reactivatingIsHeldToTheSameRule() {
        User u = account(6L, Role.AGENT, FIRM_A, BRANCH_A);
        FirmMembership a = rows.in(6L, FIRM_A).orElseThrow();
        service.setActive(u, a, false, false);
        service.join(u, Role.AGENT, FIRM_B, BRANCH_B, false);

        assertThatThrownBy(() -> service.setActive(u, a, true, false))
                .isInstanceOf(ApiException.class);
        assertThat(a.isActive()).isFalse();
    }

    @Test
    void addingSomeoneAlreadyActiveHereIsAConflictNotADuplicate() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);

        assertThatThrownBy(() -> service.join(u, Role.SENIOR_MANAGER, FIRM_A, null, false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already a member");
    }

    /* ---------- the account row ---------- */

    @Test
    void switchingOffTheHomeMovesItToAnotherActiveEntity() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);
        service.join(u, Role.SENIOR_MANAGER, FIRM_B, null, false);

        service.setActive(u, rows.in(5L, FIRM_A).orElseThrow(), false, false);

        assertThat(u.isActive()).isTrue();
        assertThat(u.getRealEstateFirmId()).isEqualTo(FIRM_B);
        assertThat(u.getRole()).isEqualTo(Role.SENIOR_MANAGER);
    }

    @Test
    void aRoleChangeAwayFromFirmLevelIsRefusedWhileActiveElsewhere() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);
        service.join(u, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, false);

        assertThatThrownBy(() -> service.change(u, rows.in(5L, FIRM_B).orElseThrow(), Role.AGENT, BRANCH_B, false))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void aNewSessionStartsAtHome_orTheFirstActiveEntity() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);
        service.join(u, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, false);
        assertThat(service.sessionStart(u)).get().extracting(FirmMembership::getRealEstateFirmId).isEqualTo(FIRM_A);

        service.makeHome(u, rows.in(5L, FIRM_B).orElseThrow());

        assertThat(service.sessionStart(u)).get().extracting(FirmMembership::getRealEstateFirmId).isEqualTo(FIRM_B);
    }

    /** Off-boarding: home in a deactivated entity, the session opens in the one still running. */
    @Test
    void aNewSessionPrefersAnEntityThatIsStillActive() {
        User u = account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);
        service.join(u, Role.AML_COMPLIANCE_OFFICER, FIRM_B, null, false);
        firms.findById(FIRM_A).orElseThrow().setActive(false);

        assertThat(service.sessionStart(u)).get().extracting(FirmMembership::getRealEstateFirmId).isEqualTo(FIRM_B);

        // With nowhere else to go, the deactivated home still opens, read-only.
        firms.findById(FIRM_B).orElseThrow().setActive(false);
        assertThat(service.sessionStart(u)).get().extracting(FirmMembership::getRealEstateFirmId).isEqualTo(FIRM_A);
    }

    @Test
    void someoneElsesMembershipReadsAsMissing() {
        account(5L, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null);
        Long theirs = rows.in(5L, FIRM_A).orElseThrow().getId();

        assertThatThrownBy(() -> service.ownedBy(99L, theirs))
                .isInstanceOf(nz.amldock.common.exception.NotFoundException.class);
    }
}
