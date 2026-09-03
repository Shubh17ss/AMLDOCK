package nz.amldock.ownership;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Every column an ownership edge carries, spelled once — see {@link nz.amldock.deal.DealFields}.
 *
 * <p>Unlike the other snapshot shapes this does not extend {@code BaseEntity}: an edge has a
 * meaningful {@code createdAt} of its own and no {@code updatedAt}, and that predates versioning.
 */
@MappedSuperclass
public abstract class OwnershipEdgeFields {

    @Column(name = "parent_node_id", nullable = false)
    private Long parentNodeId;

    @Column(name = "child_node_id", nullable = false)
    private Long childNodeId;

    /** 0.00 – 100.00. NULL is fine for role-based edges (e.g. trustees). */
    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private EdgeRole role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getParentNodeId() { return parentNodeId; }
    public void setParentNodeId(Long v) { this.parentNodeId = v; }
    public Long getChildNodeId() { return childNodeId; }
    public void setChildNodeId(Long v) { this.childNodeId = v; }
    public BigDecimal getPercentage() { return percentage; }
    public void setPercentage(BigDecimal v) { this.percentage = v; }
    public EdgeRole getRole() { return role; }
    public void setRole(EdgeRole v) { this.role = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }

    /**
     * The id of the edge these columns describe.
     *
     * <p>On the live entity that is the row's own id; on the deal's per-version copy it is
     * the id of the row that was frozen, not the copy's. DTOs built from either side have to
     * agree on what an id means — an edge naming a node, a link naming a deal — so this is the
     * one they read, and {@code getId()} stays each table's own primary key.
     */
    public abstract Long getEdgeId();
}
