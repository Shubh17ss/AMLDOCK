package nz.amldock.training;

/**
 * How a course question is answered. Both kinds are auto-scorable — a free-text type was
 * deliberately left out so the pass percentage is always exact.
 */
public enum QuestionType {
    /** Exactly one option is correct. */
    SINGLE_CHOICE,
    /** One or more options are correct. */
    MULTI_CHOICE
}
