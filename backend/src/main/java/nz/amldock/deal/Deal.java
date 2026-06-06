package nz.amldock.deal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "deal")
public class Deal extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String reference;

    @Column(name = "firm_branch_id", nullable = false)
    private Long firmBranchId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DealStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 32)
    private TransactionType transactionType;

    @Column(name = "transaction_value_nzd")
    private BigDecimal transactionValueNzd;

    @Column(name = "poc_name") private String pocName;
    @Column(name = "poc_role") private String pocRole;
    @Column(name = "poc_phone") private String pocPhone;
    @Column(name = "poc_email") private String pocEmail;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "assigned_compliance_user_id")
    private Long assignedComplianceUserId;

    @Column(name = "decision_notes", columnDefinition = "text")
    private String decisionNotes;

    /** General deal-level notes from the broker (set in the wizard's review step). */
    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "decided_by_user_id")
    private Long decidedByUserId;

    @Column(name = "decided_at")
    private Instant decidedAt;

    public Long getId() { return id; }
    public String getReference() { return reference; }
    public void setReference(String v) { this.reference = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long v) { this.propertyId = v; }
    public Long getClientId() { return clientId; }
    public void setClientId(Long v) { this.clientId = v; }
    public DealStatus getStatus() { return status; }
    public void setStatus(DealStatus v) { this.status = v; }
    public TransactionType getTransactionType() { return transactionType; }
    public void setTransactionType(TransactionType v) { this.transactionType = v; }
    public BigDecimal getTransactionValueNzd() { return transactionValueNzd; }
    public void setTransactionValueNzd(BigDecimal v) { this.transactionValueNzd = v; }
    public String getPocName() { return pocName; }
    public void setPocName(String v) { this.pocName = v; }
    public String getPocRole() { return pocRole; }
    public void setPocRole(String v) { this.pocRole = v; }
    public String getPocPhone() { return pocPhone; }
    public void setPocPhone(String v) { this.pocPhone = v; }
    public String getPocEmail() { return pocEmail; }
    public void setPocEmail(String v) { this.pocEmail = v; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long v) { this.createdByUserId = v; }
    public Long getAssignedComplianceUserId() { return assignedComplianceUserId; }
    public void setAssignedComplianceUserId(Long v) { this.assignedComplianceUserId = v; }
    public String getDecisionNotes() { return decisionNotes; }
    public void setDecisionNotes(String v) { this.decisionNotes = v; }
    public String getNotes() { return notes; }
    public void setNotes(String v) { this.notes = v; }
    public Long getDecidedByUserId() { return decidedByUserId; }
    public void setDecidedByUserId(Long v) { this.decidedByUserId = v; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant v) { this.decidedAt = v; }
}
