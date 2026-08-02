package nz.amldock.training.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * A sat assessment. The client sends only which options it picked — it never receives the answer
 * key, so all scoring happens server-side.
 *
 * A content-only course (no questions) is submitted with an empty list; that is the
 * "mark as done" path.
 */
public record SubmitCourseAttemptRequest(List<AnswerInput> answers) {

    public record AnswerInput(
            @NotNull Long questionId,
            List<Long> selectedOptionIds) {
    }
}
