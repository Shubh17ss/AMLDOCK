package nz.amldock.document;

/**
 * Which face of an identity card a scan is.
 *
 * <p>Only ever set on {@link DocumentType#isOcrEligible()} documents. A front and a back sharing
 * a {@code beneficial_owner_id} are two images of one card, and so one person.
 */
public enum IdSide {
    /** The face carrying the photograph — and, on both an NZ licence and a passport, the fields. */
    FRONT,
    /** Optional. Present on cards that have one; a passport photo page stands alone. */
    BACK
}
