package nz.amldock.deal;

/**
 * Why a purchaser is buying - asked on a PURCHASE in place of the vendor's reason for selling,
 * and scored by {@link DealRiskService}.
 *
 * <p><strong>Placeholder scale.</strong> The reasons and their points are a first cut, to be
 * replaced once the firm settles its own; change them here and every deal rescores on its next
 * write. Codes are stored as strings with no CHECK constraint (V73), so adding one needs no
 * migration; renaming one strands the deals that hold it.
 *
 * <p><strong>Keep in sync with</strong> {@code REASONS_FOR_PURCHASE} in the frontend's
 * {@code data/purchaseAnswers.js}.
 */
public enum ReasonForPurchase {
    OWNER_OCCUPIER("Owner-occupier / family home", 0),
    FIRST_HOME("First home", 0),
    INVESTMENT("Investment / rental", 0),
    BUSINESS_PREMISES("Business premises", 0),
    DEVELOPMENT("Development / subdivision", 1),
    LAND_BANKING("Land banking", 2),
    ON_BEHALF_OF_ANOTHER("Buying on behalf of another party", 4),
    OTHER("Other", 1);

    private final String label;
    private final int points;

    ReasonForPurchase(String label, int points) {
        this.label = label;
        this.points = points;
    }

    public String label() { return label; }
    public int points() { return points; }
}
