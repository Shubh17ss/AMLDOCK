package nz.amldock.training.dto;

import java.util.List;

/**
 * The verdict on one question, returned only after the taker has committed to an answer.
 *
 * This deliberately gives up the key for that question — the taker asked to be shown it, and
 * seeing the right answer is the point of a training assessment. The player locks the question
 * once checked so the revealed answer can't be turned into a mark on this attempt, but with
 * retakes unlimited a taker who works through once can pass the next time. That is accepted:
 * this teaches the material, it does not invigilate anyone.
 */
public record AnswerFeedbackDto(boolean correct, List<Long> correctOptionIds) {
}
