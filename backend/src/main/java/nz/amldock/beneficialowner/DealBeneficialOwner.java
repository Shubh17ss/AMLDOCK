package nz.amldock.beneficialowner;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Joins a person to a deal — the "one person, many deals" relation.
 *
 * <p>A join table rather than an array of deal ids on {@link BeneficialOwner}, because an array
 * cannot carry a foreign key and so nothing would stop it referencing deals that no longer exist.
 */
@Entity
@Table(name = "deal_beneficial_owner")
@IdClass(DealBeneficialOwner.Key.class)
public class DealBeneficialOwner {

    @Id
    @Column(name = "deal_id")
    private Long dealId;

    @Id
    @Column(name = "beneficial_owner_id")
    private Long beneficialOwnerId;

    /** The scan this person entered this deal through. */
    @Column(name = "source_document_id")
    private Long sourceDocumentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() { this.createdAt = Instant.now(); }

    public DealBeneficialOwner() {}

    public DealBeneficialOwner(Long dealId, Long beneficialOwnerId, Long sourceDocumentId) {
        this.dealId = dealId;
        this.beneficialOwnerId = beneficialOwnerId;
        this.sourceDocumentId = sourceDocumentId;
    }

    public Long getDealId() { return dealId; }
    public Long getBeneficialOwnerId() { return beneficialOwnerId; }
    public Long getSourceDocumentId() { return sourceDocumentId; }
    public Instant getCreatedAt() { return createdAt; }

    /** Composite key mirroring the table's PRIMARY KEY (deal_id, beneficial_owner_id). */
    public static class Key implements Serializable {
        private Long dealId;
        private Long beneficialOwnerId;

        public Key() {}
        public Key(Long dealId, Long beneficialOwnerId) {
            this.dealId = dealId;
            this.beneficialOwnerId = beneficialOwnerId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key k)) return false;
            return Objects.equals(dealId, k.dealId)
                    && Objects.equals(beneficialOwnerId, k.beneficialOwnerId);
        }

        @Override
        public int hashCode() { return Objects.hash(dealId, beneficialOwnerId); }
    }
}
