package nz.amldock.ownership;

/**
 * Which party to the deal an ownership structure describes.
 *
 * <p>The vendor's is the deal's compliance subject: it feeds the risk rating, the verification
 * readiness checks and the versions taken at sign-off. The purchaser's is recorded once the deal
 * has closed as sold, and touches none of those - it is evidence gathered after the sign-off, not
 * under it.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_structure_side} (V70).
 */
public enum StructureSide {
    VENDOR,
    PURCHASER
}
