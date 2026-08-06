package nz.amldock.training.dto;

import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.util.List;

/**
 * A partial session edit — null means "leave this alone", following
 * {@link nz.amldock.user.dto.UpdateUserRequest}.
 *
 * {@code description} is the exception: it has replace semantics, so sending an empty string
 * clears it. {@code sessionDate} is required on the session and so can only ever be replaced,
 * never cleared.
 *
 * A non-null {@code assigneeUserIds} replaces the whole roster; staff who remain assigned keep
 * whatever completion they had recorded.
 */
public record UpdateTrainingSessionRequest(
        String name,
        String description,
        String location,
        String url,
        Long trainingProviderId,
        LocalDate sessionDate,
        @PositiveOrZero Integer totalMinutes,
        List<Long> assigneeUserIds) {
}
