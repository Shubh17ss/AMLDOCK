package nz.amldock.ownership;

/**
 * Denormalised cache of the node's verification state.
 * Source of truth lives in verification_check (M9 milestone).
 *
 * <p>Only the two VERIFIED values are reachable from the Verification tab. The other three are
 * written when a node is created - by hand, by extraction, or as an implied trust - and all read
 * as "Not Verified" to a reviewer, because silence and a failure both mean not cleared yet.
 */
public enum NodeVerificationStatus {
    NOT_STARTED,
    IN_PROGRESS,
    VERIFIED,
    /**
     * Cleared despite a gap in the evidence. A different decision from {@link #VERIFIED}, not a
     * weaker one, and the reason it was granted is required - see
     * {@code OwnershipNodeFields.verificationNotes}.
     */
    VERIFIED_WITH_EXCEPTION,
    FAILED;

    /** Whether this state clears the owner at all, by either route. */
    public boolean isVerified() {
        return this == VERIFIED || this == VERIFIED_WITH_EXCEPTION;
    }
}
