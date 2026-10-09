package nz.amldock.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findAllByDealIdAndStatusOrderByCreatedAtDesc(Long dealId, DocumentStatus status);
    List<Document> findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(Long nodeId, DocumentStatus status);

    /**
     * Every document on any of these nodes, whatever its status.
     *
     * <p>Status-blind on purpose, unlike the finder above: the caller is about to delete the nodes,
     * and {@code document.ownership_node_id} is ON DELETE CASCADE, so every row here is going
     * regardless of what state it was in. Anything filtered out would leave its file in the bucket.
     */
    List<Document> findAllByOwnershipNodeIdIn(Collection<Long> nodeIds);
    Optional<Document> findByS3Key(String s3Key);

    /** The images making up one person's identity document — at most a front and a back. */
    List<Document> findAllByBeneficialOwnerIdAndStatus(Long beneficialOwnerId, DocumentStatus status);

    /*
     * Claiming the next documents to extract, in two queries.
     *
     * {@code FOR UPDATE SKIP LOCKED} is Postgres's work-queue primitive: concurrent workers, in this
     * process or another instance, each take a disjoint set instead of colliding on the same rows.
     * That is what removes any need for ShedLock or leader election.
     *
     * It used to be one query, "(due PENDING) OR (stale IN_PROGRESS) ORDER BY ocr_next_attempt_at
     * NULLS FIRST, id". Fresh uploads had a NULL due time, and a B-tree keeps NULLs last, so the
     * index could not supply that order and every poll sorted the whole backlog. Each query below
     * matches its own partial index exactly (V60), so it reads about as many index entries as it
     * returns, whatever the size of the backlog. FOR UPDATE does not allow a UNION, hence two
     * calls. The same fix V55 made for the notification outbox.
     *
     * When reading EXPLAIN on a small database, the planner may choose a sequential scan while
     * document is tiny. That is correct, not a sign the index is unused, and it switches over on
     * its own as the table grows.
     */

    /**
     * Documents a worker claimed and never finished: a process killed mid-Textract leaves
     * IN_PROGRESS behind, and without this it would sit there forever. Served by
     * {@code idx_document_ocr_stale}, which holds only in-flight rows.
     */
    @Query(value = """
            SELECT id FROM document
             WHERE ocr_status = 'IN_PROGRESS' AND ocr_claimed_at < :staleBefore
             ORDER BY ocr_claimed_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findStaleOcrClaimIds(@Param("staleBefore") Instant staleBefore, @Param("limit") int limit);

    /**
     * Ordinary waiting work: PENDING documents whose due time has come, oldest first. A fresh
     * upload is due when confirmed; a retry after its backoff. Served by
     * {@code idx_document_ocr_due (ocr_next_attempt_at, id) WHERE ocr_status = 'PENDING'}.
     */
    @Query(value = """
            SELECT id FROM document
             WHERE ocr_status = 'PENDING' AND ocr_next_attempt_at <= now()
             ORDER BY ocr_next_attempt_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findDueOcrIds(@Param("limit") int limit);
}
