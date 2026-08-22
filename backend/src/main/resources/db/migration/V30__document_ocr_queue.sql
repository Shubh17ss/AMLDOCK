-- V30: turn the OCR flag into a real work queue.
--
-- V5 laid down ocr_status plus a partial index and called it "that queue; Textract dispatch
-- hooks in here later". This is that hook. What was missing is everything a queue needs beyond
-- a flag: a claim marker, a retry schedule, and somewhere to put the reason a scan failed.
--
-- The queue lives in the database rather than SQS because ocr_status is written in the *same
-- transaction* as the document going ACTIVE (DocumentService.confirmUpload). Work item and data
-- commit atomically, so there is no window where one exists without the other. Publishing to an
-- external broker would reintroduce that window — the dual-write problem whose standard fix,
-- the outbox pattern, is this table.

ALTER TABLE document
    ADD COLUMN ocr_attempt_count   INT NOT NULL DEFAULT 0,
    -- When this row next becomes eligible. NULL means "immediately" — a freshly confirmed
    -- upload has no backoff to serve.
    ADD COLUMN ocr_next_attempt_at TIMESTAMPTZ,
    ADD COLUMN ocr_error           TEXT,
    -- Set when a worker claims the row. Its age is what makes a crashed worker's claim
    -- collectable; without it an abandoned IN_PROGRESS row is indistinguishable from one
    -- being actively worked.
    ADD COLUMN ocr_claimed_at      TIMESTAMPTZ;

-- IN_PROGRESS separates "claimed by a worker" from "waiting to be claimed".
ALTER TABLE document DROP CONSTRAINT chk_document_ocr_status;

ALTER TABLE document ADD CONSTRAINT chk_document_ocr_status CHECK (ocr_status IN (
    'NOT_APPLICABLE','PENDING','IN_PROGRESS','DONE','FAILED'
));

-- Replaces the V5 index, which covered only PENDING and so could not serve the lease-recovery
-- arm of the claim query.
--
-- Still partial, and that is the point: the index holds only in-flight rows, so a poll costs
-- O(backlog) rather than O(documents) and degenerates to a no-op once the queue drains. That
-- is what makes polling every few seconds free enough to sit alongside request traffic.
DROP INDEX IF EXISTS idx_document_ocr_pending;

CREATE INDEX idx_document_ocr_claimable ON document (ocr_next_attempt_at, id)
    WHERE ocr_status IN ('PENDING','IN_PROGRESS');
