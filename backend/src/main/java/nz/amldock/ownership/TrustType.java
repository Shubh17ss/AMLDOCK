package nz.amldock.ownership;

/**
 * What a trust was set up to do.
 *
 * <p>Risk-relevant on its own terms — a charitable trust and an asset protection trust invite
 * very different questions — but nothing here changes the deal's rating today. Only
 * {@link TrustHoldingComplexity} does that.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_node_trust_type} (V36) and
 * {@code TRUST_TYPES} in {@code frontend/src/api/ownership.js}.
 */
public enum TrustType {
    FAMILY,
    CHARITABLE,
    INVESTMENT,
    /** Created by a will, taking effect on death. */
    TESTAMENTARY,
    ASSET_PROTECTION,
    SUPERANNUATION,
    /** Beneficiaries hold fixed, defined interests rather than the trustee's discretion. */
    INHERITANCE_DEFINED_INTEREST
}
