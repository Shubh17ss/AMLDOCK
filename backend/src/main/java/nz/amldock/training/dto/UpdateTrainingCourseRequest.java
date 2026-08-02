package nz.amldock.training.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.time.LocalDate;
import java.util.List;

/**
 * A partial course edit — null means "leave this alone", following
 * {@link UpdateTrainingSessionRequest}.
 *
 * A non-null {@code questions} replaces the whole questionnaire; a non-null
 * {@code assigneeUserIds} replaces the roster, and staff who remain assigned keep whatever
 * completion they had recorded.
 *
 * {@code dueDate} is the one exception to the null rule — it is applied as sent, so clearing the
 * date actually clears it rather than being silently ignored.
 */
public record UpdateTrainingCourseRequest(
        String name,
        String description,
        LocalDate dueDate,
        @Min(1) @Max(100) Integer passMarkPercent,
        List<CreateTrainingCourseRequest.QuestionInput> questions,
        List<Long> assigneeUserIds) {
}
