package nz.amldock.ownership;

import nz.amldock.deal.TransactionType;

/**
 * Which party to the deal an ownership structure describes.
 *
 * <p>One side is the deal's compliance <em>subject</em> - our client. Its structure feeds the
 * risk rating, the verification readiness checks and the versions taken at sign-off. Which side
 * that is follows the deal's {@link TransactionType}: the vendor on a SALE, the purchaser on a
 * PURCHASE. The other side is the <em>counterparty</em>, recorded once the deal has closed as
 * completed, and touches none of those - it is evidence gathered after the sign-off, not under it.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_structure_side} (V70).
 */
public enum StructureSide {
    VENDOR,
    PURCHASER;

    /** The client's side on a deal of this type. A deal without one predates purchasers: VENDOR. */
    public static StructureSide subjectOf(TransactionType type) {
        return type == TransactionType.PURCHASE ? PURCHASER : VENDOR;
    }

    /** The other party's side on a deal of this type. */
    public static StructureSide counterpartyOf(TransactionType type) {
        return subjectOf(type).other();
    }

    public StructureSide other() {
        return this == VENDOR ? PURCHASER : VENDOR;
    }
}
