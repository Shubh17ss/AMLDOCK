package nz.amldock.notification;

import nz.amldock.user.Role;

/**
 * What a user receives before anyone has touched their preferences.
 *
 * <p>A missing {@code deal_notification_preference} row means "whatever this returns". Rows are
 * written only when somebody explicitly toggles, so the table holds deviations rather than a copy
 * of everyone's settings.
 *
 * <p>That is why V40 seeds nothing. Seeding would have needed a hook on every path that creates a
 * user or a branch — {@code UserService.create}, {@code createBulk}, and {@code update}, plus
 * {@code BranchService.create} and {@code FirmService.createPlaceholderBranches}, which bypasses
 * the former — and a miss would have been invisible: somebody quietly stops receiving mail, with
 * nothing to see. Resolving at read time cannot fail that way, and new users and branches inherit
 * the default without anyone remembering to make them.
 *
 * <p>Exhaustive switch, no {@code default:} arm: a new role fails to compile here rather than
 * inheriting whichever answer happens to be last.
 */
public final class NotificationDefaults {

    private NotificationDefaults() {}

    /**
     * Everything on, for every eligible role. Deal activity is the thing this application exists to
     * track, so the useful default is to be told about it; the tuning-down is what the preferences
     * screens are for.
     *
     * <p>Ineligible roles answer {@code false} rather than throwing, so a caller that has not
     * already filtered on {@link NotificationEligibility#isEligible} still cannot mail them.
     */
    public static boolean defaultEnabled(Role role, DealNotificationEvent event) {
        if (!NotificationEligibility.isEligible(role)) {
            return false;
        }
        return switch (event) {
            case DEAL_CREATED, DEAL_STATUS_CHANGED -> true;
        };
    }
}
