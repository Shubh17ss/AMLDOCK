-- Makes claiming from the OCR queue cost the same whatever the size of the backlog: the fix V55
-- made for the notification outbox, applied to the same defect here.
--
-- The claim was one query: "(due PENDING) OR (stale IN_PROGRESS) ORDER BY ocr_next_attempt_at
-- NULLS FIRST, id", over idx_document_ocr_claimable (ocr_next_attempt_at, id). A freshly confirmed
-- upload had ocr_next_attempt_at = NULL. A B-tree keeps NULLs last, the query wanted them first,
-- and the OR mixed two different predicates, so the index could not supply the order: Postgres
-- read and sorted the whole backlog for every poll (every 5 s, on every instance). The outbox
-- measured 299 ms per poll at a 362k backlog (perf/reports/2026-10-06-outbox-claim.md), growing
-- with the backlog, which is worst exactly when the work has fallen behind.
--
-- Now:
--   * DocumentService.confirmUpload sets ocr_next_attempt_at = now when a document becomes
--     PENDING (never NULL while claimable; retries already set a backoff time);
--   * the claim is two queries (DocumentRepository.findStaleOcrClaimIds / findDueOcrIds), each
--     served by a partial index matching its predicate and its ORDER BY exactly, so each reads
--     about as many index entries as it returns.
--
-- ocr_next_attempt_at stays nullable: DONE and FAILED clear it, and are never claimed.

-- Existing waiting rows (and any in flight) get an explicit due time. created_at keeps them in
-- the order they would have been claimed.
UPDATE document
   SET ocr_next_attempt_at = created_at
 WHERE ocr_status IN ('PENDING', 'IN_PROGRESS')
   AND ocr_next_attempt_at IS NULL;

DROP INDEX IF EXISTS idx_document_ocr_claimable;

-- Due work: WHERE ocr_status = 'PENDING' AND ocr_next_attempt_at <= now()
--           ORDER BY ocr_next_attempt_at, id
CREATE INDEX idx_document_ocr_due
    ON document (ocr_next_attempt_at, id)
    WHERE ocr_status = 'PENDING';

-- Abandoned claims: WHERE ocr_status = 'IN_PROGRESS' AND ocr_claimed_at < ?
--                   ORDER BY ocr_claimed_at, id. Holds only in-flight rows, so it stays tiny.
CREATE INDEX idx_document_ocr_stale
    ON document (ocr_claimed_at, id)
    WHERE ocr_status = 'IN_PROGRESS';
