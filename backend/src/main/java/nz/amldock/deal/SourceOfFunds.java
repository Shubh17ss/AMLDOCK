package nz.amldock.deal;

/**
 * Where a purchaser's money for the deal comes from - asked on a PURCHASE in place of the
 * vendor's ownership tenure, and scored by {@link DealRiskService}.
 *
 * <p>The points are the scale: change them here and every deal rescores on its next write. Codes
 * are stored as strings with no CHECK constraint (V73), so adding one needs no migration; renaming
 * one strands the deals that hold it.
 *
 * <p><strong>Keep in sync with</strong> {@code SOURCES_OF_FUNDS} in the frontend's
 * {@code data/purchaseAnswers.js}.
 */
public enum SourceOfFunds {
    MORTGAGE("Bank mortgage / finance", 0),
    SAVINGS("Savings / salary", 0),
    PROPERTY_SALE("Sale of another property", 0),
    INHERITANCE("Inheritance", 1),
    BUSINESS_INCOME("Business income", 2),
    GIFT("Gift from family or a third party", 3),
    OVERSEAS("Overseas funds", 3),
    TBC("To be confirmed", 3),
    CASH("Cash", 6),
    OTHER("Other", 2);

    private final String label;
    private final int points;

    SourceOfFunds(String label, int points) {
        this.label = label;
        this.points = points;
    }

    public String label() { return label; }
    public int points() { return points; }
}
