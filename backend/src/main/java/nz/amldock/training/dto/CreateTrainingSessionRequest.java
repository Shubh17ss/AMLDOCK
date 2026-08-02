package nz.amldock.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.util.List;

/**
 * A new training session.
 *
 * {@code certifiedMinutes} may not exceed {@code totalMinutes} and every id in
 * {@code assigneeUserIds} must be branch-level staff of this session's branch — both are
 * cross-field rules the service enforces.
 */
public record CreateTrainingSessionRequest(
        @NotBlank String name,
        @NotBlank String location,
        String url,
        @NotNull Long trainingProviderId,
        LocalDate dueDate,
        @NotNull @PositiveOrZero Integer totalMinutes,
        @NotNull @PositiveOrZero Integer certifiedMinutes,
        List<Long> assigneeUserIds,
        Long realEstateFirmId,
        Long firmBranchId) {
}
