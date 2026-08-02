package nz.amldock.training.dto;

import nz.amldock.training.TrainingSession;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * One session as the UI sees it.
 *
 * {@code attendees} is the full roster for training managers; for a staff member it holds only
 * their own row, so the register never leaks who else was assigned. {@code assignedCount} and
 * {@code completedCount} are always the true totals so the progress figure stays honest.
 */
public record TrainingSessionDto(
        Long id,
        String name,
        String location,
        String url,
        Long trainingProviderId,
        String providerName,
        LocalDate dueDate,
        Integer totalMinutes,
        Integer certifiedMinutes,
        Long realEstateFirmId,
        Long firmBranchId,
        String branchName,
        String createdByEmail,
        Instant createdAt,
        List<TrainingAttendeeDto> attendees,
        int assignedCount,
        int completedCount,
        boolean assignedToMe,
        Instant myCompletedAt
) {
    public static TrainingSessionDto from(TrainingSession s,
                                          String providerName,
                                          String branchName,
                                          String createdByEmail,
                                          List<TrainingAttendeeDto> attendees,
                                          int assignedCount,
                                          int completedCount,
                                          boolean assignedToMe,
                                          Instant myCompletedAt) {
        return new TrainingSessionDto(
                s.getId(), s.getName(), s.getLocation(), s.getUrl(),
                s.getTrainingProviderId(), providerName, s.getDueDate(),
                s.getTotalMinutes(), s.getCertifiedMinutes(),
                s.getRealEstateFirmId(), s.getFirmBranchId(), branchName,
                createdByEmail, s.getCreatedAt(),
                attendees, assignedCount, completedCount, assignedToMe, myCompletedAt);
    }
}
