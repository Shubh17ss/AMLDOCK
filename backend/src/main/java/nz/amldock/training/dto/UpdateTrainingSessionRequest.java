package nz.amldock.training.dto;

import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.util.List;

/**
 * A partial session edit — null means "leave this alone", following
 * {@link nz.amldock.user.dto.UpdateUserRequest}.
 *
 * A non-null {@code assigneeUserIds} replaces the whole roster; staff who remain assigned keep
 * whatever completion they had recorded.
 */
public record UpdateTrainingSessionRequest(
        String name,
        String location,
        String url,
        Long trainingProviderId,
        LocalDate dueDate,
        @PositiveOrZero Integer totalMinutes,
        @PositiveOrZero Integer certifiedMinutes,
        List<Long> assigneeUserIds) {
}
