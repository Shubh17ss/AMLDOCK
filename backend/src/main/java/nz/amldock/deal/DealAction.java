package nz.amldock.deal;

/**
 * The verbs a deal's lifecycle exposes — one per endpoint.
 *
 * <p>Each maps to a row in {@code DealLifecycleService.RULES}, which says which statuses it may
 * be applied from, what it moves the deal to, who may do it, and whether it needs a note.
 * Adding a verb means adding a row, not a method with its own checks.
 */
public enum DealAction {
    /** NEW → HANDOVER. The broker has finished. */
    HANDOVER,
    /** HANDOVER → REVIEW. Assigns the deal to nobody; any reviewer in the firm may still act. */
    START_REVIEW,
    /** REVIEW → ON_HOLD. Note required. */
    HOLD,
    /** REVIEW → VERIFIED. Note required. */
    VERIFY,
    /** VERIFIED → CLOSED. */
    CLOSE,
    /** HANDOVER | REVIEW | ON_HOLD → NEW, handing edit rights back to the broker. Note required. */
    REVERT
}
