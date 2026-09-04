package nz.amldock.deal;

/**
 * The verbs a deal's lifecycle exposes — one per endpoint.
 *
 * <p>Each maps to a row in {@code DealLifecycleService.RULES}, which says which statuses it may
 * be applied from, what it moves the deal to, who may do it, and whether it needs a note.
 * Adding a verb means adding a row, not a method with its own checks.
 */
public enum DealAction {
    /** NEW → REVIEW. The broker has finished and the deal passes straight to compliance. */
    SUBMIT,
    /** REVIEW → ON_HOLD. Note required. */
    HOLD,
    /** REVIEW → VERIFIED. Note required. */
    VERIFY,
    /** VERIFIED → CLOSED. */
    CLOSE,
    /** REVIEW | ON_HOLD → NEW, handing edit rights back to the broker. Note required. */
    REVERT,
    /**
     * VERIFIED → REVIEW, putting a signed-off deal back in compliance's hands for changes.
     * Note required.
     *
     * <p>Safe to offer because verifying writes a {@link nz.amldock.deal.version.DealVersion}
     * first: what was signed off is a copy, and nothing done to the deal afterwards can reach it.
     * Without that copy this verb would be the edit-the-evidence problem the lock exists to
     * prevent.
     */
    REOPEN
}
