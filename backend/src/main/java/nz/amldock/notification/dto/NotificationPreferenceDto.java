package nz.amldock.notification.dto;

import nz.amldock.notification.DealNotificationEvent;

/**
 * One toggle: what this user gets for this event on this branch.
 *
 * @param enabled the *effective* answer, with the role default already applied, so the UI never
 *                has to know the matrix
 * @param source  {@code EXPLICIT} if somebody set it, {@code DEFAULT} if it is the role default
 *                showing through. Absence of a row is the normal state, not an unconfigured one,
 *                so the screens can say "on by default" rather than implying nothing is set up
 */
public record NotificationPreferenceDto(
        Long firmBranchId,
        String branchName,
        DealNotificationEvent eventType,
        boolean enabled,
        String source
) {
    public static final String EXPLICIT = "EXPLICIT";
    public static final String DEFAULT = "DEFAULT";
}
