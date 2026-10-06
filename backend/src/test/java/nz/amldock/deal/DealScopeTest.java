package nz.amldock.deal;

import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Which deals a list may show. The role pins the scope and overwrites what the caller asked for;
 * every deal-scoped list (deals, summary, individuals, assurance) goes through this one rule.
 */
class DealScopeTest {

    static final Long FIRM = 1L;
    static final Long BRANCH = 10L;
    static final Long OTHER_FIRM = 2L;
    static final Long OTHER_BRANCH = 20L;

    @Test
    void anAgentSeesTheirOwnAndSharedDealsWhateverBranchTheyAskFor() {
        DealScope s = DealScope.forActor(user(Role.AGENT), null, OTHER_BRANCH);
        assertThat(s.creatorId()).isEqualTo(7L);
    }

    @Test
    void branchStaffArePinnedToTheirOwnBranch() {
        assertThat(DealScope.forActor(user(Role.SALES_MANAGER), null, OTHER_BRANCH))
                .isEqualTo(new DealScope(null, null, BRANCH));
        assertThat(DealScope.forActor(user(Role.ADMIN), null, null))
                .isEqualTo(new DealScope(null, null, BRANCH));
    }

    @Test
    void firmStaffArePinnedToTheirFirmButMayNarrowToABranch() {
        assertThat(DealScope.forActor(user(Role.AML_COMPLIANCE_OFFICER), OTHER_FIRM, BRANCH))
                .isEqualTo(new DealScope(null, FIRM, BRANCH));
        assertThat(DealScope.forActor(user(Role.SENIOR_MANAGER), null, null))
                .isEqualTo(new DealScope(null, FIRM, null));
    }

    @Test
    void rootAndAuditUseTheFiltersAsGiven() {
        assertThat(DealScope.forActor(user(Role.ROOT), OTHER_FIRM, null))
                .isEqualTo(new DealScope(null, OTHER_FIRM, null));
        assertThat(DealScope.forActor(user(Role.AUDIT), null, null))
                .isEqualTo(new DealScope(null, null, null));
    }

    @Test
    void financeHasNoDealsToList() {
        assertThatThrownBy(() -> DealScope.forActor(user(Role.FINANCE), null, null))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void theAgentPredicateIncludesDealsSharedWithThem() {
        StringBuilder sql = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();
        new DealScope(7L, null, null).appendWhere(sql, params, "d");
        // A UNION of two indexed lookups, not an OR that defeats both indexes.
        assertThat(sql.toString()).contains("created_by_user_id = :scopeCreator").contains("UNION").contains("deal_user")
                .doesNotContain(" OR ");
        assertThat(params.getValue("scopeCreator")).isEqualTo(7L);
    }

    @Test
    void onlyAnUnscopedCallerSearchesPlatformWide() {
        assertThat(new DealScope(null, null, null).isNarrow()).isFalse();
        assertThat(new DealScope(7L, null, null).isNarrow()).isTrue();
        assertThat(new DealScope(null, null, BRANCH).isNarrow()).isTrue();
        assertThat(new DealScope(null, FIRM, null).isNarrow()).isTrue();
    }

    @Test
    void anUnscopedCallerAddsNoPredicate() {
        StringBuilder sql = new StringBuilder();
        new DealScope(null, null, null).appendWhere(sql, new MapSqlParameterSource(), "d");
        assertThat(sql.toString()).isEmpty();
    }

    private static UserPrincipal user(Role role) {
        return new UserPrincipal(7L, "u@firm.com", null, role, FIRM, BRANCH, true);
    }
}
