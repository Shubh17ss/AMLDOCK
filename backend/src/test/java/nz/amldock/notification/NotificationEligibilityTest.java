package nz.amldock.notification;

import nz.amldock.user.Role;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Who may be emailed about a deal is a security-adjacent boundary, so the matrix is pinned here
 * rather than left to be re-derived from the enum. Same discipline as {@code RoleTest}.
 */
class NotificationEligibilityTest {

    private static final Set<Role> ELIGIBLE = EnumSet.of(
            Role.AGENT, Role.AGENT_PA, Role.ADMIN, Role.SALES_MANAGER,
            Role.AML_COMPLIANCE_OFFICER, Role.SENIOR_MANAGER);

    @Test
    void everyRoleIsClassifiedExplicitly() {
        for (Role role : Role.values()) {
            assertThat(NotificationEligibility.isEligible(role))
                    .as("%s eligibility", role)
                    .isEqualTo(ELIGIBLE.contains(role));
        }
    }

    /**
     * The three exclusions are a judgement rather than a consequence of read scope: assertCanRead
     * forbids only FINANCE, and hands ROOT and AUDIT everything. If someone later decides the
     * platform account should be mailed, this test is where that argument has to be had.
     */
    @Test
    void platformAndSpecialistRolesAreNotRecipients() {
        assertThat(NotificationEligibility.isEligible(Role.ROOT)).isFalse();
        assertThat(NotificationEligibility.isEligible(Role.AUDIT)).isFalse();
        assertThat(NotificationEligibility.isEligible(Role.FINANCE)).isFalse();
    }

    @Test
    void onlyBrokersAreLimitedToTheirOwnDeals() {
        for (Role role : Role.values()) {
            boolean expected = role == Role.AGENT || role == Role.AGENT_PA;
            assertThat(NotificationEligibility.isOwnDealsOnly(role))
                    .as("%s own-deals-only", role)
                    .isEqualTo(expected);
        }
    }

    /**
     * Firm-wide is exactly the pair whose app_user.firm_branch_id is NULL *and* who are eligible.
     * FINANCE is also firm-scoped-without-a-branch and must not be swept in — the same distinction
     * Role.isFirmLevel draws.
     */
    @Test
    void onlyComplianceOfficersAndSeniorManagersChoosePerBranch() {
        for (Role role : Role.values()) {
            boolean expected = role == Role.AML_COMPLIANCE_OFFICER || role == Role.SENIOR_MANAGER;
            assertThat(NotificationEligibility.isFirmWide(role))
                    .as("%s firm-wide", role)
                    .isEqualTo(expected);
        }
        assertThat(NotificationEligibility.isFirmWide(Role.FINANCE)).isFalse();
    }

    @Test
    void everyFirmWideRoleIsAlsoEligible() {
        for (Role role : Role.values()) {
            if (NotificationEligibility.isFirmWide(role)) {
                assertThat(NotificationEligibility.isEligible(role))
                        .as("%s is firm-wide so must be eligible", role)
                        .isTrue();
            }
        }
    }
}
