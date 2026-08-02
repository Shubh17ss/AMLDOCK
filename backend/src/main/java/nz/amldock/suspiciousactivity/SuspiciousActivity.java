package nz.amldock.suspiciousactivity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;
import nz.amldock.document.DocumentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One entry in the Suspicious Activity Register — a potential suspicion logged before (or
 * instead of) a formal SAR. Scoped to a firm and optionally a branch, like
 * {@link nz.amldock.fundtransaction.InternationalFundTransaction}. The supporting PDF is
 * optional: the s3/document columns stay null until an upload is presigned.
 */
@Entity
@Table(name = "suspicious_activity")
public class SuspiciousActivity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "suspicion_type", nullable = false, length = 16)
    private SuspicionType suspicionType;

    /** Only meaningful for a TRANSACTION — nulled out for an ACTIVITY. */
    @Column(name = "amount_nzd", precision = 18, scale = 2)
    private BigDecimal amountNzd;

    /** The person or entity the suspicion concerns. */
    @Column(name = "name", nullable = false, length = 512)
    private String name;

    @Column(name = "date_of_suspicion", nullable = false)
    private LocalDate dateOfSuspicion;

    @Enumerated(EnumType.STRING)
    @Column(name = "red_flag", nullable = false, length = 64)
    private RedFlag redFlag;

    @Column(name = "reference", length = 255)
    private String reference;

    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    @Column(name = "action_taken", columnDefinition = "text")
    private String actionTaken;

    @Column(name = "s3_key", unique = true, length = 1024)
    private String s3Key;

    @Column(name = "original_filename", length = 512)
    private String originalFilename;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_status", length = 32)
    private DocumentStatus documentStatus;

    @Column(name = "real_estate_firm_id")
    private Long realEstateFirmId;

    @Column(name = "firm_branch_id")
    private Long firmBranchId;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    public Long getId() { return id; }
    public SuspicionType getSuspicionType() { return suspicionType; }
    public void setSuspicionType(SuspicionType v) { this.suspicionType = v; }
    public BigDecimal getAmountNzd() { return amountNzd; }
    public void setAmountNzd(BigDecimal v) { this.amountNzd = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public LocalDate getDateOfSuspicion() { return dateOfSuspicion; }
    public void setDateOfSuspicion(LocalDate v) { this.dateOfSuspicion = v; }
    public RedFlag getRedFlag() { return redFlag; }
    public void setRedFlag(RedFlag v) { this.redFlag = v; }
    public String getReference() { return reference; }
    public void setReference(String v) { this.reference = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public String getActionTaken() { return actionTaken; }
    public void setActionTaken(String v) { this.actionTaken = v; }
    public String getS3Key() { return s3Key; }
    public void setS3Key(String v) { this.s3Key = v; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String v) { this.originalFilename = v; }
    public String getContentType() { return contentType; }
    public void setContentType(String v) { this.contentType = v; }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long v) { this.sizeBytes = v; }
    public DocumentStatus getDocumentStatus() { return documentStatus; }
    public void setDocumentStatus(DocumentStatus v) { this.documentStatus = v; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long v) { this.realEstateFirmId = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long v) { this.createdByUserId = v; }
}
