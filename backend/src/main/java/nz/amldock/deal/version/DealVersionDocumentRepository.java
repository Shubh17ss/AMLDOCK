package nz.amldock.deal.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DealVersionDocumentRepository extends JpaRepository<DealVersionDocument, Long> {

    List<DealVersionDocument> findAllByDealVersionId(Long dealVersionId);

    Optional<DealVersionDocument> findByDealVersionIdAndSourceDocumentId(Long dealVersionId, Long sourceDocumentId);

    /**
     * Whether any verified version still refers to this document.
     *
     * <p>{@code DocumentService.delete} asks this before removing the object from S3. A document a
     * sign-off lists has to stay readable from that sign-off even once it has left the live deal.
     * Served by idx_dvd_source.
     */
    boolean existsBySourceDocumentId(Long sourceDocumentId);
}
