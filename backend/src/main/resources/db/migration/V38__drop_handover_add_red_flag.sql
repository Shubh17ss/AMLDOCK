/*
 * Removes the HANDOVER status and records *which* red flag a broker saw.
 *
 * HANDOVER was a staging status between the broker and compliance: the broker handed over, and a
 * reviewer then separately "started review". Nobody worked the queue in between, so the deal now
 * moves NEW → REVIEW in one step. Any row still sitting in HANDOVER is exactly a deal waiting to
 * be reviewed, so it lands in REVIEW — no information is lost.
 *
 * deal.red_flag_present is a boolean and stays one; red_flag names the flag when it is true. The
 * values are RedFlag enum names, deliberately with no CHECK constraint so a new option is a code
 * change rather than a migration — the same choice V20 made for suspicious_activity.red_flag.
 */

/* ---------- 1. HANDOVER → REVIEW ---------- */

-- Dropped first: the UPDATE is fine under the old constraint, but the new one must not be added
-- while HANDOVER rows still exist.
ALTER TABLE deal DROP CONSTRAINT chk_deal_status;

UPDATE deal SET status = 'REVIEW' WHERE status = 'HANDOVER';

ALTER TABLE deal ADD CONSTRAINT chk_deal_status
    CHECK (status IN ('NEW','REVIEW','ON_HOLD','VERIFIED','CLOSED'));

-- The timeline's recorded transitions. chk_deal_note_transition only requires both-or-neither, so
-- a remapped row whose from and to both become REVIEW stays legal; it reads as the handover step
-- that no longer exists, which is the honest rendering of a history that had one.
UPDATE deal_note SET status_from = 'REVIEW' WHERE status_from = 'HANDOVER';
UPDATE deal_note SET status_to   = 'REVIEW' WHERE status_to   = 'HANDOVER';

-- AuditAction is mapped @Enumerated(STRING), so a name dropped from the enum throws when an old
-- row is read. DEAL_REVIEW_STARTED folds into the submission it now happens as part of.
UPDATE audit_log SET action = 'DEAL_SUBMITTED_FOR_REVIEW'
WHERE action IN ('DEAL_HANDED_OVER', 'DEAL_REVIEW_STARTED');

/* ---------- 2. which red flag ---------- */

ALTER TABLE deal ADD COLUMN red_flag VARCHAR(64);
