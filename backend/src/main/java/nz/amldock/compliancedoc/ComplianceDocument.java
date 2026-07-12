package nz.amldock.compliancedoc;

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

@Entity
@Table(name = "compliance_document")
public class ComplianceDocument extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 64)
    private ComplianceDocCategory category;

    @Column(nullable = false, length = 512)
    private String name;

    @Column(name = "change_notes", columnDefinition = "text")
    private String changeNotes;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Column(name = "s3_key", nullable = false, unique = true, length = 1024)
    private String s3Key;

    @Column(name = "original_filename", nullable = false, length = 512)
    private String originalFilename;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DocumentStatus status = DocumentStatus.PENDING;

    @Column(name = "real_estate_firm_id")
    private Long realEstateFirmId;

    @Column(name = "firm_branch_id")
    private Long firmBranchId;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private Long uploadedByUserId;

    public Long getId() { return id; }
    public ComplianceDocCategory getCategory() { return category; }
    public void setCategory(ComplianceDocCategory v) { this.category = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getChangeNotes() { return changeNotes; }
    public void setChangeNotes(String v) { this.changeNotes = v; }
    public int getVersionNo() { return versionNo; }
    public void setVersionNo(int v) { this.versionNo = v; }
    public String getS3Key() { return s3Key; }
    public void setS3Key(String v) { this.s3Key = v; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String v) { this.originalFilename = v; }
    public String getContentType() { return contentType; }
    public void setContentType(String v) { this.contentType = v; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long v) { this.sizeBytes = v; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus v) { this.status = v; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long v) { this.realEstateFirmId = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public Long getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(Long v) { this.uploadedByUserId = v; }
}
