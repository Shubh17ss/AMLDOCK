package nz.amldock.ownership;

/**
 * How much the trust holds.
 *
 * <p>Three named bands rather than a property count. The distinction that matters is between a
 * trust holding the family home and a trust operating as an investment vehicle, and a count
 * cannot express the second — "four properties" and "four properties plus a share portfolio and
 * an overseas company" are the same number and a different risk.
 *
 * <p>{@link #EXTENSIVE_DIVERSE_PORTFOLIO} raises the deal to HIGH — see {@code DealRiskService}.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_node_trust_holding} (V36) and
 * {@code TRUST_HOLDING_COMPLEXITY} in {@code frontend/src/api/ownership.js}.
 */
public enum TrustHoldingComplexity {
    SINGLE_PROPERTY_ASSET,
    MORE_THAN_ONE_PROPERTY_ASSET,
    EXTENSIVE_DIVERSE_PORTFOLIO
}
