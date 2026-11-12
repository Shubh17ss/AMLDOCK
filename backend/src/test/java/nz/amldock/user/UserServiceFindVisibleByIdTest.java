package nz.amldock.user;

import nz.amldock.auth.RefreshTokenRepository;
import nz.amldock.auth.TokenStateCache;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;

/**
 * GET /api/users/{id} (C-04).
 *
 * <p>It used to be a bare lookup behind a role list, so a manager of one firm could read any user
 * on the platform by id. It now answers only for users the same actor would see in the list.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceFindVisibleByIdTest {

    static final Long FIRM_A = 1L;
    static final Long FIRM_B = 2L;
    static final Long BRANCH_10 = 10L;   // firm A
    static final Long BRANCH_11 = 11L;   // firm A
    static final Long BRANCH_20 = 20L;   // firm B

    static final Long AGENT_A10 = 100L;
    static final Long AGENT_A11 = 101L;
    static final Long AGENT_B20 = 200L;

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock PasswordEncoder encoder;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock TokenStateCache tokenStates;

    UserService service;
    MembershipFixture memberships;

    @BeforeEach
    void setUp() {
        memberships = new MembershipFixture();
        service = new UserService(users, firms, branches, encoder, refreshTokens, tokenStates,
                memberships.repo, new MembershipService(memberships.repo, users, firms));
        stubUser(AGENT_A10, FIRM_A, BRANCH_10);
        stubUser(AGENT_A11, FIRM_A, BRANCH_11);
        stubUser(AGENT_B20, FIRM_B, BRANCH_20);
    }

    @Test
    void aComplianceOfficerCannotReadAnotherFirmsUser() {
        assertHidden(actor(Role.AML_COMPLIANCE_OFFICER, FIRM_A, null), AGENT_B20);
    }

    @Test
    void aSeniorManagerCannotReadAnotherFirmsUser() {
        assertHidden(actor(Role.SENIOR_MANAGER, FIRM_A, null), AGENT_B20);
    }

    @Test
    void firmLevelStaffReadTheirWholeFirm() {
        assertThat(service.findVisibleById(actor(Role.AML_COMPLIANCE_OFFICER, FIRM_A, null), AGENT_A11, null).user().getId())
                .isEqualTo(AGENT_A11);
        assertThat(service.findVisibleById(actor(Role.SENIOR_MANAGER, FIRM_A, null), AGENT_A10, null).user().getId())
                .isEqualTo(AGENT_A10);
    }

    @Test
    void aSalesManagerReadsOnlyTheirOwnBranch() {
        UserPrincipal sm = actor(Role.SALES_MANAGER, FIRM_A, BRANCH_10);
        assertThat(service.findVisibleById(sm, AGENT_A10, null).user().getId()).isEqualTo(AGENT_A10);
        // Same firm, other branch: outside the list, so outside this too.
        assertHidden(sm, AGENT_A11);
        assertHidden(sm, AGENT_B20);
    }

    @Test
    void rootAndAuditReadAnyone() {
        assertThat(service.findVisibleById(actor(Role.ROOT, null, null), AGENT_B20, null).user().getId())
                .isEqualTo(AGENT_B20);
        assertThat(service.findVisibleById(actor(Role.AUDIT, null, null), AGENT_A10, null).user().getId())
                .isEqualTo(AGENT_A10);
    }

    @Test
    void anAgentReadsNobodyThroughThisEndpoint() {
        assertHidden(actor(Role.AGENT, FIRM_A, BRANCH_10), AGENT_A10);
    }

    private void assertHidden(UserPrincipal actor, Long id) {
        assertThatThrownBy(() -> service.findVisibleById(actor, id, null))
                .isInstanceOf(NotFoundException.class);
    }

    private static UserPrincipal actor(Role role, Long firmId, Long branchId) {
        return new UserPrincipal(9L, "actor@x.nz", null, role, firmId, branchId, true);
    }

    private void stubUser(Long id, Long firmId, Long branchId) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setRole(Role.AGENT);
        u.setRealEstateFirmId(firmId);
        u.setFirmBranchId(branchId);
        lenient().when(users.findById(id)).thenReturn(Optional.of(u));
        memberships.add(id, Role.AGENT, firmId, branchId, true);
    }

    /**
     * An officer serving two entities is visible from each, as what they are there, and an
     * officer of a third entity cannot see them at all.
     */
    @Test
    void anOfficerInTwoEntitiesIsSeenFromEachAsTheirRoleThere() {
        Long officer = 40L;
        User u = new User();
        ReflectionTestUtils.setField(u, "id", officer);
        u.setRole(Role.AML_COMPLIANCE_OFFICER);
        u.setRealEstateFirmId(FIRM_A);
        lenient().when(users.findById(officer)).thenReturn(Optional.of(u));
        memberships.add(officer, Role.AML_COMPLIANCE_OFFICER, FIRM_A, null, true);
        memberships.add(officer, Role.SENIOR_MANAGER, FIRM_B, null, true);

        assertThat(service.findVisibleById(actor(Role.SENIOR_MANAGER, FIRM_A, null), officer, null).role())
                .isEqualTo(Role.AML_COMPLIANCE_OFFICER);
        assertThat(service.findVisibleById(actor(Role.AML_COMPLIANCE_OFFICER, FIRM_B, null), officer, null).role())
                .isEqualTo(Role.SENIOR_MANAGER);
        assertHidden(actor(Role.AML_COMPLIANCE_OFFICER, 3L, null), officer);
    }
}
