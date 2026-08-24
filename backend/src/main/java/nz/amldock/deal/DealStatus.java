package nz.amldock.deal;

/**
 * Where a deal sits in the compliance process.
 *
 * <p>These name a <em>position</em> — who is holding the deal and how far verification has got —
 * rather than a decision. There is deliberately no rejected state: a deal that cannot pass sits
 * in {@link #ON_HOLD}, or is reverted to {@link #NEW} for the broker to fix.
 *
 * <p>The transitions between them live in {@link DealLifecycleService}, which is the only place
 * a status changes.
 */
public enum DealStatus {
    /** The broker is still working on it. The only status in which a deal may be edited. */
    NEW,
    /** The broker has submitted it and compliance is working on it. */
    REVIEW,
    /** Parked — the only negative outcome. Exits by reverting to NEW. */
    ON_HOLD,
    /** Compliance has verified it. */
    VERIFIED,
    /** Finished. Terminal. */
    CLOSED
}
