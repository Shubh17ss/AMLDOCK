package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerFields;
import org.springframework.beans.BeanUtils;

/**
 * A person on the deal, as they were described at verification.
 *
 * <p>This is the copy with the strongest case for existing. {@code beneficial_owner} is scoped to
 * the firm and shared across its deals — the same row backs this person wherever they appear — so
 * a reviewer correcting a date of birth on an unrelated deal would otherwise rewrite who a
 * verified deal says it checked. The sign-off has to keep its own account of that.
 */
@Entity
@Table(name = "deal_version_person")
public class DealVersionPerson extends BeneficialOwnerFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    @Column(name = "source_beneficial_owner_id", nullable = false, updatable = false)
    private Long sourceBeneficialOwnerId;

    /** From {@code deal_beneficial_owner}: which document put this person on the deal. */
    @Column(name = "source_document_id")
    private Long sourceDocumentId;

    @Override
    protected boolean stampsOwnTimestamps() { return false; }

    public static DealVersionPerson copyOf(BeneficialOwner p, Long dealVersionId, Long sourceDocumentId) {
        DealVersionPerson c = new DealVersionPerson();
        BeanUtils.copyProperties(p, c);
        c.createdAt = p.getCreatedAt();
        c.updatedAt = p.getUpdatedAt();
        c.dealVersionId = dealVersionId;
        c.sourceBeneficialOwnerId = p.getId();
        c.sourceDocumentId = sourceDocumentId;
        return c;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public Long getSourceDocumentId() { return sourceDocumentId; }
    public Long getBeneficialOwnerId() { return sourceBeneficialOwnerId; }
}
