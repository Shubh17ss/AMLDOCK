package nz.amldock.ownership;

/**
 * How much the trust holds.
 *
 * <p>Four named bands rather than a property count. The distinction that matters is between a
 * trust holding the family home and a trust operating as an investment vehicle, and a count
 * cannot express the second — "four properties" and "four properties plus a share portfolio and
 * an overseas company" are the same number and a different risk.
 *
 * <p>{@link #UNASCERTAINABLE} is the highest-scoring band, above {@link #EXTENSIVE_DIVERSE_PORTFOLIO}:
 * not knowing what a trust holds is worse than knowing it holds a great deal, because the second
 * is a measured fact and the first is the absence of one. See {@code DealRiskService} for the
 * points each band carries.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_node_trust_holding} (rebuilt by V46) and
 * {@code TRUST_HOLDING_COMPLEXITY} in {@code frontend/src/api/ownership.js}.
 */
public enum TrustHoldingComplexity {
    SINGLE_PROPERTY_ASSET,
    MORE_THAN_ONE_PROPERTY_ASSET,
    EXTENSIVE_DIVERSE_PORTFOLIO,
    UNASCERTAINABLE
}
