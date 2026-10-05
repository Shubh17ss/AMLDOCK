package nz.amldock.deal;

import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.UserPrincipal;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

/**
 * Which deals a caller may list: the set-level twin of {@link DealLifecycleService#assertCanRead}.
 * Use that one for a single deal, this one for a list, because asserting per row would throw on
 * the first deal outside the caller's scope instead of leaving it out.
 *
 * <p>The requested firm and branch are <em>overwritten</em> by whatever the actor's own role
 * pins, not merely intersected with it. An agent asking for a branch still gets only their own
 * deals.
 *
 * <p>Every deal-scoped list goes through this one rule: the deals list, the dashboard summary,
 * the individuals register (which reaches people through their deals) and the assurance register.
 * A second transcription of it would be a second thing to keep right.
 *
 * @param creatorId set for agents: deals they created, plus any they have been added to
 * @param firmId    deals on any branch of this firm
 * @param branchId  deals on this branch
 */
public record DealScope(Long creatorId, Long firmId, Long branchId) {

    /**
     * A switch with no default, so a new role fails to compile here rather than defaulting into
     * whichever branch happens to be last.
     */
    public static DealScope forActor(UserPrincipal actor, Long firmIdFilter, Long branchIdFilter) {
        Long creator = null;
        Long firm = firmIdFilter;
        Long branch = branchIdFilter;
        switch (actor.role()) {
            // Their own deals plus any they have been added to (deal_user).
            case AGENT, AGENT_PA -> creator = actor.id();
            case ADMIN, SALES_MANAGER -> branch = actor.firmBranchId();
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> firm = actor.realEstateFirmId();
            // Both see every firm, so the caller's filters stand as given.
            case ROOT, AUDIT -> { /* honour passed filters verbatim */ }
            // Finance works in the fund register, not the CDD workspace. Stated rather than left
            // to fall through, which would have handed over every deal.
            case FINANCE -> throw new ForbiddenException("Deals are outside the finance role");
        }
        return new DealScope(creator, firm, branch);
    }

    /**
     * Appends this scope as {@code AND ...} predicates on the deal table aliased {@code d}.
     * Optional parts are left out entirely rather than written as {@code :x IS NULL OR ...},
     * which keeps the plans index-friendly and sidesteps Postgres' untyped-null parameters.
     */
    public void appendWhere(StringBuilder sql, MapSqlParameterSource params, String d) {
        if (creatorId != null) {
            sql.append(" AND (").append(d).append(".created_by_user_id = :scopeCreator OR ")
               .append(d).append(".id IN (SELECT du.deal_id FROM deal_user du WHERE du.user_id = :scopeCreator))");
            params.addValue("scopeCreator", creatorId);
        }
        if (branchId != null) {
            sql.append(" AND ").append(d).append(".firm_branch_id = :scopeBranch");
            params.addValue("scopeBranch", branchId);
        }
        if (firmId != null) {
            sql.append(" AND ").append(d).append(".firm_branch_id IN ")
               .append("(SELECT fb.id FROM firm_branch fb WHERE fb.real_estate_firm_id = :scopeFirm)");
            params.addValue("scopeFirm", firmId);
        }
    }
}
