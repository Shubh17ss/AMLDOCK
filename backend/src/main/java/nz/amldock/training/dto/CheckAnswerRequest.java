package nz.amldock.training.dto;

import java.util.List;

/**
 * One question's answer, sent to be marked as the taker works through the assessment.
 *
 * A null or empty list is a valid request — it marks as wrong and reveals the answer, which is
 * what "I don't know" should do.
 */
public record CheckAnswerRequest(List<Long> selectedOptionIds) {
}
