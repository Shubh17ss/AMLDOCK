package nz.amldock.ownership;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

@Entity
@Table(name = "ownership_structure")
public class OwnershipStructure extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false, unique = true)
    private Long dealId;

    @Column(name = "root_node_id")
    private Long rootNodeId;

    @Column(columnDefinition = "text")
    private String notes;

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public void setDealId(Long v) { this.dealId = v; }
    public Long getRootNodeId() { return rootNodeId; }
    public void setRootNodeId(Long v) { this.rootNodeId = v; }
    public String getNotes() { return notes; }
    public void setNotes(String v) { this.notes = v; }
}
