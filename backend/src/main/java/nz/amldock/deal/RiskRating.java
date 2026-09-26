package nz.amldock.deal;

/**
 * The deal's AML risk position, banded from the score {@link DealRiskService} accumulates.
 *
 * <p>MEDIUM was unreachable until V46. The rule was "on-sold quickly, a nominee, a complex
 * company or an extensive trust portfolio ⇒ HIGH, otherwise LOW", which could not tell a deal
 * carrying six small concerns from one carrying a single large one. Both bands and the score
 * behind them now come from {@link #forValue}.
 */
public enum RiskRating {
    LOW,
    MEDIUM,
    HIGH;

    /**
     * The band a score falls in: LOW 0-2, MEDIUM 3-5, HIGH 6 and above.
     *
     * <p>The single place the thresholds are written. Reading them off a score rather than
     * setting the band directly is what keeps a rating and its own workings in agreement — the
     * Risk tab prints both, and a band that disagreed with the factors above it would be the one
     * thing a reviewer cannot act on.
     */
    public static RiskRating forValue(int value) {
        if (value >= 6) return HIGH;
        if (value >= 3) return MEDIUM;
        return LOW;
    }
}
