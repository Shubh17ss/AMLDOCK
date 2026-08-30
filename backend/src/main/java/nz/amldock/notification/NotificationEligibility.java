package nz.amldock.notification;

import nz.amldock.user.Role;

/**
 * Which roles can receive deal notifications at all, and on what scope.
 *
 * <p>This is the send-time twin of {@link nz.amldock.deal.DealLifecycleService#assertCanRead} and
 * {@link nz.amldock.deal.DealService#readableDeals} — a subscriber must never be told about a deal
 * they could not open. Those two, this class, and {@code frontend/src/auth/roles.js} are the four
 * statements of the same rule; changing one means changing all four.
 *
 * <p>Every method is an exhaustive switch with no {@code default:} arm, so a new role fails to
 * compile here rather than defaulting into whichever branch happens to be last.
 */
public final class NotificationEligibility {

    private NotificationEligibility() {}

    /**
     * Whether this role can be a recipient.
     *
     * <p>The three exclusions are a judgement, not a consequence of read scope — {@code
     * assertCanRead} genuinely forbids FINANCE, but grants ROOT and AUDIT access to everything.
     * ROOT is a firm-less platform account with no operational stake in any one deal, and AUDIT
     * reads the record rather than being alerted by it. Mailing either on every deal in the
     * platform would be noise, not oversight.
     *
     * <p>Note this cannot be inferred from the preference table's shape: {@code
     * deal_notification_preference.firm_branch_id} is NOT NULL, but so is a compliance officer's
     * subscription, and their own {@code app_user.firm_branch_id} is NULL. The pref's branch is
     * the *deal's* branch, not the user's, so the guard has to be stated.
     */
    public static boolean isEligible(Role role) {
        return switch (role) {
            case AGENT, AGENT_PA, ADMIN, SALES_MANAGER, AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> true;
            case ROOT, AUDIT, FINANCE -> false;
        };
    }

    /** Hears only about deals they authored. Ownership is authorship — there is no assignee field. */
    public static boolean isOwnDealsOnly(Role role) {
        return switch (role) {
            case AGENT, AGENT_PA -> true;
            case ADMIN, SALES_MANAGER, AML_COMPLIANCE_OFFICER, SENIOR_MANAGER,
                 ROOT, AUDIT, FINANCE -> false;
        };
    }

    /**
     * Scoped to a firm rather than one branch, so their subscription is per branch: one toggle for
     * each branch of their firm, rather than the single toggle branch-level staff get.
     */
    public static boolean isFirmWide(Role role) {
        return switch (role) {
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> true;
            case AGENT, AGENT_PA, ADMIN, SALES_MANAGER, ROOT, AUDIT, FINANCE -> false;
        };
    }
}
