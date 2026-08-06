package nz.amldock.fundtransaction;

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
 * One entry in the International Fund Transaction Register. Scoped to a firm and optionally
 * a branch, like {@link nz.amldock.compliancedoc.ComplianceDocument}. The supporting PDF is
 * optional: the s3/document columns stay null until an upload is presigned.
 */
@Entity
@Table(name = "international_fund_transaction")
public class InternationalFundTransaction extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Free-text deal reference as typed by the user — deliberately not a link to a Deal row. */
    @Column(name = "deal_reference", length = 255)
    private String dealReference;

    @Column(name = "listing_address", nullable = false, length = 512)
    private String listingAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_flow", nullable = false, length = 16)
    private TransactionFlow transactionFlow;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    /** In the reporting entity's own currency — see RealEstateFirm.country. */
    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    /** ISO 3166-1 alpha-2 country code. */
    @Column(name = "overseas_jurisdiction", nullable = false, length = 2)
    private String overseasJurisdiction;

    @Column(name = "submission_reference", length = 255)
    private String submissionReference;

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
    public String getDealReference() { return dealReference; }
    public void setDealReference(String v) { this.dealReference = v; }
    public String getListingAddress() { return listingAddress; }
    public void setListingAddress(String v) { this.listingAddress = v; }
    public TransactionFlow getTransactionFlow() { return transactionFlow; }
    public void setTransactionFlow(TransactionFlow v) { this.transactionFlow = v; }
    public LocalDate getTransactionDate() { return transactionDate; }
    public void setTransactionDate(LocalDate v) { this.transactionDate = v; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal v) { this.amount = v; }
    public String getOverseasJurisdiction() { return overseasJurisdiction; }
    public void setOverseasJurisdiction(String v) { this.overseasJurisdiction = v; }
    public String getSubmissionReference() { return submissionReference; }
    public void setSubmissionReference(String v) { this.submissionReference = v; }
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
