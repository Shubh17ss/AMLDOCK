package nz.amldock.document;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findAllByDealIdAndStatusOrderByCreatedAtDesc(Long dealId, DocumentStatus status);
    Optional<Document> findByS3Key(String s3Key);
}
