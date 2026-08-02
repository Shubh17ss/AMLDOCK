package nz.amldock.training.dto;

import nz.amldock.training.TrainingCourse;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * One course as the UI sees it.
 *
 * Two things are narrowed for anyone who isn't a training manager: {@code assignees} holds only
 * their own row, and every option's {@code correct} flag comes back null. The counts stay true
 * either way.
 */
public record TrainingCourseDto(
        Long id,
        String name,
        String description,
        LocalDate dueDate,
        Integer passMarkPercent,
        Long realEstateFirmId,
        Long firmBranchId,
        String branchName,
        String createdByEmail,
        Instant createdAt,
        List<TrainingCourseFileDto> files,
        List<TrainingCourseQuestionDto> questions,
        List<TrainingAttendeeDto> assignees,
        int assignedCount,
        int completedCount,
        boolean assignedToMe,
        Instant myCompletedAt
) {
    public static TrainingCourseDto from(TrainingCourse c,
                                         String branchName,
                                         String createdByEmail,
                                         List<TrainingCourseFileDto> files,
                                         List<TrainingCourseQuestionDto> questions,
                                         List<TrainingAttendeeDto> assignees,
                                         int assignedCount,
                                         int completedCount,
                                         boolean assignedToMe,
                                         Instant myCompletedAt) {
        return new TrainingCourseDto(
                c.getId(), c.getName(), c.getDescription(), c.getDueDate(), c.getPassMarkPercent(),
                c.getRealEstateFirmId(), c.getFirmBranchId(), branchName, createdByEmail,
                c.getCreatedAt(), files, questions, assignees,
                assignedCount, completedCount, assignedToMe, myCompletedAt);
    }
}
