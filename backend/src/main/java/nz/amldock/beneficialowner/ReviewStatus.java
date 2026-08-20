package nz.amldock.beneficialowner;

/**
 * Whether a human has agreed with what the machine read.
 *
 * <p>Everything extraction produces starts UNREVIEWED. Nothing acts on this yet; it exists so
 * that when something does, it can tell a confirmed identity from an OCR guess.
 */
public enum ReviewStatus {
    UNREVIEWED,
    CONFIRMED,
    REJECTED
}
