package nz.amldock.training;

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

/**
 * One piece of course material. A row per file, like the {@code document} table — course content
 * is usually several artefacts, so this is not the embedded single-file shape the monitoring
 * registers use.
 *
 * Unlike the compliance and monitoring uploads, content files carry no content-type restriction:
 * slides, spreadsheets, images and video are all legitimate training material. Size is still
 * capped.
 */
@Entity
@Table(name = "training_course_file")
public class TrainingCourseFile extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "training_course_id", nullable = false)
    private Long trainingCourseId;

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

    @Column(name = "uploaded_by_user_id", nullable = false)
    private Long uploadedByUserId;

    public Long getId() { return id; }
    public Long getTrainingCourseId() { return trainingCourseId; }
    public void setTrainingCourseId(Long v) { this.trainingCourseId = v; }
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
    public Long getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(Long v) { this.uploadedByUserId = v; }
}
