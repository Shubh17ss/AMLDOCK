package nz.amldock.ownership;

/**
 * Denormalised cache of the node's verification state.
 * Source of truth lives in verification_check (M9 milestone).
 */
public enum NodeVerificationStatus {
    NOT_STARTED,
    IN_PROGRESS,
    VERIFIED,
    FAILED
}
