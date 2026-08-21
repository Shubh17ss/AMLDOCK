package nz.amldock.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findAllByDealIdAndStatusOrderByCreatedAtDesc(Long dealId, DocumentStatus status);
    List<Document> findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(Long nodeId, DocumentStatus status);
    Optional<Document> findByS3Key(String s3Key);

    /** The images making up one person's identity document — at most a front and a back. */
    List<Document> findAllByBeneficialOwnerIdAndStatus(Long beneficialOwnerId, DocumentStatus status);

    /**
     * Claims the next batch of documents to extract.
     *
     * <p>{@code FOR UPDATE SKIP LOCKED} is Postgres's work-queue primitive: concurrent workers,
     * in this process or another instance, each take a disjoint set instead of colliding on the
     * same rows. That is what removes any need for ShedLock or leader election.
     *
     * <p>Two arms. The first is ordinary waiting work. The second reclaims rows a worker claimed
     * and never finished — a process killed mid-Textract leaves IN_PROGRESS behind, and without
     * this it would sit there forever.
     *
     * <p>Served by {@code idx_document_ocr_claimable}, which is partial: it indexes only in-flight
     * rows, so the cost tracks the backlog rather than the size of the table. That is what makes
     * polling every few seconds cheap enough to run beside request traffic.
     *
     * <p>Note when reading EXPLAIN on a small database: the planner will choose a sequential scan
     * while {@code document} is tiny, which is correct rather than a sign the index is unused —
     * forcing {@code enable_seqscan = off} shows it picked up. It switches over on its own as the
     * table grows.
     */
    @Query(value = """
            SELECT id FROM document
             WHERE (ocr_status = 'PENDING'
                    AND (ocr_next_attempt_at IS NULL OR ocr_next_attempt_at <= now()))
                OR (ocr_status = 'IN_PROGRESS' AND ocr_claimed_at < :staleBefore)
             ORDER BY ocr_next_attempt_at NULLS FIRST, id
             FOR UPDATE SKIP LOCKED
             LIMIT :batchSize
            """, nativeQuery = true)
    List<Long> findClaimableOcrIds(@Param("staleBefore") Instant staleBefore,
                                   @Param("batchSize") int batchSize);
}
