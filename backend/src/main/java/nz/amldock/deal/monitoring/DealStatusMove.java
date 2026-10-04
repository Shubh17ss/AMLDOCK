package nz.amldock.deal.monitoring;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One move of a deal between VERIFIED and CLOSED, with its figures as they were at that moment.
 *
 * <p>Append-only: written once, inside the transaction that made the move, and never updated. That
 * is the point of it — the deal row keeps only the latest sale, and this is where the earlier
 * ones go on being true. See V52.
 */
@Entity
@Table(name = "deal_status_move")
public class DealStatusMove {

    public enum Kind { CLOSE, UNCLOSE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false, updatable = false)
    private Long dealId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 16, updatable = false)
    private Kind kind;

    /** When the deal entered the state this move takes it out of. */
    @Column(name = "from_at", updatable = false)
    private Instant fromAt;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "actor_user_id", updatable = false)
    private Long actorUserId;

    @Column(name = "version_no", updatable = false)
    private Integer versionNo;

    @Column(name = "valuation_min", updatable = false)
    private BigDecimal valuationMin;

    @Column(name = "valuation_max", updatable = false)
    private BigDecimal valuationMax;

    @Column(name = "property_sold", updatable = false)
    private Boolean propertySold;

    @Column(name = "sale_total", updatable = false)
    private BigDecimal saleTotal;

    @Column(name = "note", columnDefinition = "text", updatable = false)
    private String note;

    protected DealStatusMove() {}

    DealStatusMove(Long dealId, Kind kind, Instant fromAt, Instant occurredAt, Long actorUserId,
                   Integer versionNo, BigDecimal valuationMin, BigDecimal valuationMax,
                   Boolean propertySold, BigDecimal saleTotal, String note) {
        this.dealId = dealId;
        this.kind = kind;
        this.fromAt = fromAt;
        this.occurredAt = occurredAt;
        this.actorUserId = actorUserId;
        this.versionNo = versionNo;
        this.valuationMin = valuationMin;
        this.valuationMax = valuationMax;
        this.propertySold = propertySold;
        this.saleTotal = saleTotal;
        this.note = note;
    }

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public Kind getKind() { return kind; }
    public Instant getFromAt() { return fromAt; }
    public Instant getOccurredAt() { return occurredAt; }
    public Long getActorUserId() { return actorUserId; }
    public Integer getVersionNo() { return versionNo; }
    public BigDecimal getValuationMin() { return valuationMin; }
    public BigDecimal getValuationMax() { return valuationMax; }
    public Boolean getPropertySold() { return propertySold; }
    public BigDecimal getSaleTotal() { return saleTotal; }
    public String getNote() { return note; }
}
