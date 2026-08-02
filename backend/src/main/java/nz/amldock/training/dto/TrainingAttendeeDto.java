package nz.amldock.training.dto;

import nz.amldock.user.Role;

import java.time.Instant;

/** One assigned staff member and whether they have completed the session. */
public record TrainingAttendeeDto(
        Long userId,
        String fullName,
        String email,
        Role role,
        Instant completedAt
) {
    public boolean completed() {
        return completedAt != null;
    }
}
