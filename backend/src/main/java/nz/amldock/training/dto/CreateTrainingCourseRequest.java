package nz.amldock.training.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import nz.amldock.training.QuestionType;

import java.time.LocalDate;
import java.util.List;

/**
 * A new course, with its questionnaire and roster in the same call.
 *
 * The questionnaire rules the service enforces (2+ options per question, exactly one correct
 * answer for SINGLE_CHOICE, at least one for MULTI_CHOICE) are cross-field and can't be
 * expressed with Bean Validation alone.
 */
public record CreateTrainingCourseRequest(
        @NotBlank String name,
        String description,
        LocalDate dueDate,
        @NotNull @Min(1) @Max(100) Integer passMarkPercent,
        List<QuestionInput> questions,
        List<Long> assigneeUserIds,
        Long realEstateFirmId,
        Long firmBranchId) {

    public record QuestionInput(
            @NotNull QuestionType questionType,
            @NotBlank String prompt,
            List<OptionInput> options) {
    }

    public record OptionInput(
            @NotBlank String label,
            boolean correct) {
    }
}
