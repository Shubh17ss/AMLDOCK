package nz.amldock.training.dto;

/**
 * One answer option.
 *
 * {@code correct} is boxed on purpose: it is nulled out for anyone who isn't a training manager
 * so the answer key never reaches a course taker's browser.
 */
public record TrainingCourseOptionDto(
        Long id,
        Integer position,
        String label,
        Boolean correct
) {
}
