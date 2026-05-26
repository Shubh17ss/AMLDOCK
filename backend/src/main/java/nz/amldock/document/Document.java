package nz.amldock.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "document")
public class Document extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "s3_key", nullable = false, unique = true, length = 1024)
    private String s3Key;

    @Column(name = "original_filename", nullable = false, length = 512)
    private String originalFilename;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 64)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DocumentStatus status = DocumentStatus.PENDING;

    @Column(name = "deal_id")
    private Long dealId;

    @Column(name = "ownership_node_id")
    private Long ownershipNodeId;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private Long uploadedByUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "ocr_status", nullable = false, length = 32)
    private OcrStatus ocrStatus = OcrStatus.NOT_APPLICABLE;

    @Column(name = "ocr_provider")
    private String ocrProvider;

    @Column(name = "ocr_raw_text", columnDefinition = "text")
    private String ocrRawText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ocr_fields", columnDefinition = "jsonb")
    private String ocrFields;

    @Column(name = "ocr_confidence")
    private BigDecimal ocrConfidence;

    @Column(name = "ocr_completed_at")
    private Instant ocrCompletedAt;

    public Long getId() { return id; }
    public String getS3Key() { return s3Key; }
    public void setS3Key(String v) { this.s3Key = v; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String v) { this.originalFilename = v; }
    public String getContentType() { return contentType; }
    public void setContentType(String v) { this.contentType = v; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long v) { this.sizeBytes = v; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType v) { this.documentType = v; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus v) { this.status = v; }
    public Long getDealId() { return dealId; }
    public void setDealId(Long v) { this.dealId = v; }
    public Long getOwnershipNodeId() { return ownershipNodeId; }
    public void setOwnershipNodeId(Long v) { this.ownershipNodeId = v; }
    public Long getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(Long v) { this.uploadedByUserId = v; }
    public OcrStatus getOcrStatus() { return ocrStatus; }
    public void setOcrStatus(OcrStatus v) { this.ocrStatus = v; }
    public String getOcrProvider() { return ocrProvider; }
    public void setOcrProvider(String v) { this.ocrProvider = v; }
    public String getOcrRawText() { return ocrRawText; }
    public void setOcrRawText(String v) { this.ocrRawText = v; }
    public String getOcrFields() { return ocrFields; }
    public void setOcrFields(String v) { this.ocrFields = v; }
    public BigDecimal getOcrConfidence() { return ocrConfidence; }
    public void setOcrConfidence(BigDecimal v) { this.ocrConfidence = v; }
    public Instant getOcrCompletedAt() { return ocrCompletedAt; }
    public void setOcrCompletedAt(Instant v) { this.ocrCompletedAt = v; }
}
