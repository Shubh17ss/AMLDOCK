package nz.amldock.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.util.List;

/**
 * A new training session.
 *
 * {@code sessionDate} is the day the session runs and is required. Every id in
 * {@code assigneeUserIds} must be branch-level staff of this session's branch — a cross-field
 * rule the service enforces.
 */
public record CreateTrainingSessionRequest(
        @NotBlank String name,
        String description,
        @NotBlank String location,
        String url,
        @NotNull Long trainingProviderId,
        @NotNull LocalDate sessionDate,
        @NotNull @PositiveOrZero Integer totalMinutes,
        List<Long> assigneeUserIds,
        Long realEstateFirmId,
        Long firmBranchId) {
}
