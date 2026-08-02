package nz.amldock.training.dto;

import java.time.Instant;

/**
 * The outcome of one attempt.
 *
 * Deliberately carries no per-question detail: retakes are unlimited, and a right/wrong list
 * would let a taker narrow down the answer key by elimination across attempts.
 */
public record CourseAttemptResultDto(
        int scorePercent,
        boolean passed,
        int passMarkPercent,
        int correctCount,
        int totalQuestions,
        int attemptCount,
        Instant completedAt
) {
}
