package nz.amldock.ownership;

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

@Entity
@Table(name = "ownership_edge")
public class OwnershipEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    public Long getId() { return id; }
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
}
