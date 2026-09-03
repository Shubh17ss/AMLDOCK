package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentFields;
import org.springframework.beans.BeanUtils;

/**
 * A document as it was filed against the deal at verification.
 *
 * <p>Only the metadata is copied. The bytes are not, and do not need to be: every S3 key carries a
 * UUID ({@code DocumentService.buildKey}), so an object is written once and never overwritten, and
 * two versions naming the same key are naming the same unchanged file.
 *
 * <p>What that costs is one guard elsewhere. {@code DocumentService.delete} would otherwise remove
 * the object from S3 while leaving the live row as {@code DELETED}, which would leave every version
 * listing a document it could no longer produce. It now asks {@code DealVersionDocumentRepository
 * .existsBySourceDocumentId} first and keeps the bytes for anything a sign-off still refers to.
 *
 * <p>{@code sourceDocumentId} is deliberately not a foreign key: the live row may go, and this
 * record of it must not go with it.
 */
@Entity
@Table(name = "deal_version_document")
public class DealVersionDocument extends DocumentFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    @Column(name = "source_document_id", nullable = false, updatable = false)
    private Long sourceDocumentId;

    @Override
    protected boolean stampsOwnTimestamps() { return false; }

    public static DealVersionDocument copyOf(Document d, Long dealVersionId) {
        DealVersionDocument c = new DealVersionDocument();
        BeanUtils.copyProperties(d, c);
        c.createdAt = d.getCreatedAt();
        c.updatedAt = d.getUpdatedAt();
        c.dealVersionId = dealVersionId;
        c.sourceDocumentId = d.getId();
        return c;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public Long getDocumentId() { return sourceDocumentId; }
}
