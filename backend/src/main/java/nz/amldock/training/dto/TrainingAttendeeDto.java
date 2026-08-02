package nz.amldock.training.dto;

import nz.amldock.user.Role;

import java.time.Instant;

/**
 * One assigned staff member and how they got on.
 *
 * {@code scorePercent} and {@code passed} are course-only — session attendance is binary, so
 * sessions pass null for both.
 */
public record TrainingAttendeeDto(
        Long userId,
        String fullName,
        String email,
        Role role,
        Instant completedAt,
        Integer scorePercent,
        Boolean passed
) {
    public boolean completed() {
        return completedAt != null;
    }

    /** Session attendance: completed or not, with no score to record. */
    public static TrainingAttendeeDto attendance(Long userId, String fullName, String email,
                                                 Role role, Instant completedAt) {
        return new TrainingAttendeeDto(userId, fullName, email, role, completedAt, null, null);
    }
}
