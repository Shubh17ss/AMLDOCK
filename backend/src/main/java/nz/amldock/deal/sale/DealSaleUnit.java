package nz.amldock.deal.sale;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One unit of a development, and what it sold for.
 *
 * <p>A development is not sold once. A subdivision or an apartment block changes hands as flats,
 * each with its own name and its own price, and the single {@code sale_price} on the deal would
 * either be a sum nobody can break down or the first unit standing in for all of them.
 *
 * <p>Rows are replaced wholesale every time the deal is closed. A close is one whole-form
 * submission rather than an incremental edit, and re-closing is how the figures get corrected —
 * so there is no identity to preserve between one close and the next, and matching rows up by
 * name would invent one out of a field the reviewer is free to retype.
 */
@Entity
@Table(name = "deal_sale_unit")
public class DealSaleUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false, updatable = false)
    private Long dealId;

    @Column(name = "unit_name", nullable = false, length = 160)
    private String unitName;

    @Column(name = "sale_price", nullable = false)
    private BigDecimal salePrice;

    /**
     * The order they were entered in.
     *
     * <p>A unit list is read as a list. Relying on the ids to sort the same way is luck rather
     * than a guarantee, and it stops being true the moment a set is replaced.
     */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected DealSaleUnit() { }

    public DealSaleUnit(Long dealId, String unitName, BigDecimal salePrice, int sortOrder) {
        this.dealId = dealId;
        this.unitName = unitName;
        this.salePrice = salePrice;
        this.sortOrder = sortOrder;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public String getUnitName() { return unitName; }
    public BigDecimal getSalePrice() { return salePrice; }
    public int getSortOrder() { return sortOrder; }
    public Instant getCreatedAt() { return createdAt; }
}
