package nz.amldock.deal;

/**
 * Where a deal's {@link RiskRating} came from.
 *
 * <p>DERIVED ratings are recomputed on every write. OVERRIDE ratings were pinned by
 * compliance and the derivation leaves them alone.
 *
 * <p>No override endpoint exists yet — this ships now so adding one later needs neither a
 * migration nor a change to the read contract, since the UI keeps reading the single
 * {@code riskRating} field either way.
 */
public enum RiskRatingSource {
    DERIVED,
    OVERRIDE
}
