-- Makes claiming from the notification outbox cost the same whatever the size of the backlog.
--
-- The claim used to be one query: "(due PENDING) OR (stale IN_PROGRESS) ORDER BY next_attempt_at
-- NULLS FIRST, id LIMIT 50", over idx_deal_notification_claimable (next_attempt_at, id). Every
-- freshly enqueued row had next_attempt_at = NULL. A B-tree keeps NULLs last, the query wanted them
-- first, and the OR mixed two different predicates, so the index could not supply the order:
-- Postgres read and sorted the whole backlog (on disk past work_mem) for every poll, on every
-- instance. Measured 299 ms per poll for 50 rows at a 362k backlog
-- (perf/reports/2026-10-06-outbox-claim.md), and growing with the backlog, which is worst exactly
-- when sending has fallen behind.
--
-- Now:
--   * rows are enqueued with next_attempt_at = the enqueue time (never NULL while claimable);
--   * the claim is two queries (DealNotificationRepository.findStaleClaimIds / findDueIds), each
--     served by a partial index matching its predicate and its ORDER BY exactly, so each reads
--     about as many index entries as it returns.
--
-- next_attempt_at stays nullable: SENT and FAILED rows clear it, and are never claimed.

-- Existing waiting rows (and any in flight) get an explicit due time. created_at keeps them in the
-- order they would have been sent.
UPDATE deal_notification
   SET next_attempt_at = created_at
 WHERE status IN ('PENDING', 'IN_PROGRESS')
   AND next_attempt_at IS NULL;

DROP INDEX IF EXISTS idx_deal_notification_claimable;

-- Due work: WHERE status = 'PENDING' AND next_attempt_at <= now() ORDER BY next_attempt_at, id
CREATE INDEX idx_deal_notification_due
    ON deal_notification (next_attempt_at, id)
    WHERE status = 'PENDING';

-- Abandoned claims: WHERE status = 'IN_PROGRESS' AND claimed_at < ? ORDER BY claimed_at, id.
-- Holds only in-flight rows, so it stays tiny.
CREATE INDEX idx_deal_notification_stale
    ON deal_notification (claimed_at, id)
    WHERE status = 'IN_PROGRESS';
