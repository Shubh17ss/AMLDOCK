package nz.amldock.notification.dto;

import nz.amldock.user.Role;

import java.util.List;

/**
 * One user and every toggle they hold, which is what both screens render: the Profile card shows a
 * single grid for the signed-in user, the Settings matrix shows one per user in the branch.
 *
 * @param preferences empty for a role that cannot receive notifications at all, which is how the
 *                    UI knows to show an explanatory line instead of an empty table
 */
public record NotificationPreferenceGridDto(
        Long userId,
        String fullName,
        String email,
        Role role,
        List<NotificationPreferenceDto> preferences
) {}
