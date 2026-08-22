package nz.amldock.deal;

/**
 * The deal's AML risk position, derived server-side by {@link DealService}.
 *
 * <p>MEDIUM is unreachable by the current rule (on-sold-quickly ⇒ HIGH, otherwise LOW). It
 * ships anyway so that growing the rule — folding in red flags, foreign exposure or reason
 * for selling — needs no migration against the chk_deal_risk_rating constraint.
 */
public enum RiskRating {
    LOW,
    MEDIUM,
    HIGH
}
