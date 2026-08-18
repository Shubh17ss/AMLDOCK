-- V29: deal lifecycle rework, end of per-deal assignment, notes timeline, remote client.
--
-- The old status set named a *decision* — APPROVED / REJECTED. The new one names a *position*:
-- who is holding the deal and how far through verification it has got. Two consequences are
-- structural rather than cosmetic:
--
--   * There is no negative terminal state. A deal that cannot pass sits in ON_HOLD, or is
--     reverted to NEW for the broker to fix. REJECTED had no way back short of an override.
--   * A deal is no longer tied to one reviewer. Any compliance officer or senior manager of the
--     firm may act on any deal in it, so the assignment column and everything hanging off it
--     goes.
--
-- The dev database is empty (see infra/reset-dev-data.sql), but every mapping UPDATE below is
-- written to be correct against a populated one.

/* ---------- 1. status ---------- */

-- Dropped first: the UPDATE writes values the V3 constraint forbids.
ALTER TABLE deal DROP CONSTRAINT chk_deal_status;

-- APPROVED maps to VERIFIED rather than CLOSED because closing is a deliberate act taken after
-- verification, and nobody has taken it on these rows.
--
-- REJECTED maps to ON_HOLD because ON_HOLD is the only state that still carries "this did not
-- pass" — and unlike REJECTED it is reversible, which is the whole point of the new model.
UPDATE deal SET status = CASE status
    WHEN 'DRAFT'        THEN 'NEW'
    WHEN 'SUBMITTED'    THEN 'HANDOVER'
    WHEN 'UNDER_REVIEW' THEN 'REVIEW'
    WHEN 'APPROVED'     THEN 'VERIFIED'
    WHEN 'REJECTED'     THEN 'ON_HOLD'
    ELSE status
END
WHERE status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED');

ALTER TABLE deal ADD CONSTRAINT chk_deal_status
    CHECK (status IN ('NEW','HANDOVER','REVIEW','ON_HOLD','VERIFIED','CLOSED'));

/* ---------- 2. end of per-deal assignment ---------- */

-- DROP COLUMN would take the index and the FK with it; naming them states the intent and keeps
-- this readable against V3, where all three were created.
DROP INDEX IF EXISTS idx_deal_assigned_compliance;
ALTER TABLE deal DROP CONSTRAINT IF EXISTS fk_deal_assignee;
ALTER TABLE deal DROP COLUMN assigned_compliance_user_id;

/* ---------- 3. notes timeline ---------- */

-- An append-only conversation per deal: reviewers' comments and one entry per state change.
-- Rows are never edited or deleted — a compliance thread that can be rewritten afterwards is
-- worth less than no thread at all.
--
-- The broker's own note is deliberately NOT copied in here. It stays on deal.notes so the
-- broker can keep editing it while the deal is NEW, and the timeline synthesises it as the
-- opening entry from deal.notes + created_by_user_id + created_at. Copying it in at handover
-- would either double-post when a reverted deal is handed over again, or need clearing logic
-- that can get out of step with the field.
--
-- Entry kind is derived, not stored, so the two can never disagree:
--     status_to IS NULL  →  a comment
--     otherwise          →  a state change, from status_from to status_to
CREATE TABLE deal_note (
    id             BIGSERIAL PRIMARY KEY,
    deal_id        BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    body           TEXT NOT NULL,
    status_from    VARCHAR(16),
    status_to      VARCHAR(16),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_deal_note_deal   FOREIGN KEY (deal_id)        REFERENCES deal(id)     ON DELETE CASCADE,
    -- RESTRICT, matching fk_deal_creator: an author who left the firm must not silently
    -- detach from what they wrote.
    CONSTRAINT fk_deal_note_author FOREIGN KEY (author_user_id) REFERENCES app_user(id) ON DELETE RESTRICT,
    -- Same 3-character floor the old decision notes enforced in DealLifecycleService.
    CONSTRAINT chk_deal_note_body CHECK (length(btrim(body)) >= 3),
    -- A state change names both ends; a comment names neither. One without the other is a
    -- half-written record.
    CONSTRAINT chk_deal_note_transition CHECK (
        (status_from IS NULL AND status_to IS NULL)
        OR (status_from IS NOT NULL AND status_to IS NOT NULL))
);

CREATE INDEX idx_deal_note_deal ON deal_note(deal_id, created_at);

-- decision_notes held one note at a time and was overwritten by each decision. The timeline
-- keeps all of them, so carry the surviving one across as the entry it always was. It is
-- recorded as a comment rather than a transition because the states it moved between were not
-- retained anywhere.
INSERT INTO deal_note (deal_id, author_user_id, body, status_from, status_to, created_at)
SELECT d.id,
       COALESCE(d.decided_by_user_id, d.created_by_user_id),
       d.decision_notes,
       NULL, NULL,
       COALESCE(d.decided_at, d.updated_at)
  FROM deal d
 WHERE d.decision_notes IS NOT NULL
   AND length(btrim(d.decision_notes)) >= 3;

ALTER TABLE deal DROP COLUMN decision_notes;

/* ---------- 4. section 3: is the client remote? ---------- */

-- Nullable, following V28's precedent for trust_involved / on_sold_quickly: NULL means "not
-- answered", which is a different compliance fact from "no".
--
-- On `deal` rather than `client`: the client entity is still provisional at capture time (V28),
-- and remoteness describes this transaction's interaction, not the party.
--
-- Deliberately NOT an input to the risk rating — see DealService.applyRiskRating. Not because
-- non-face-to-face is harmless (it is a standard AML factor) but because its real consequence
-- is a CDD *method* trigger, and folding a second boolean into a documented single-input rule
-- would silently re-rate every existing deal on its next write, with no MEDIUM tier defined to
-- absorb the middle.
ALTER TABLE deal ADD COLUMN client_remote BOOLEAN;

/* ---------- 5. audit actions ---------- */

-- audit_log.action has no CHECK (V1), so at the schema level this is a Java-only change. But
-- AuditLog maps the column with @Enumerated(STRING), so a value the enum no longer has throws
-- on read rather than rendering as a stale label. This UPDATE is required for correctness.
--
-- DEAL_ASSIGNED → DEAL_REVIEW_STARTED is the closest honest reading: claiming a deal is what
-- moved it into review, and the actor on the row is the person who did it.
UPDATE audit_log SET action = CASE action
    WHEN 'DEAL_SUBMITTED' THEN 'DEAL_HANDED_OVER'
    WHEN 'DEAL_ASSIGNED'  THEN 'DEAL_REVIEW_STARTED'
    WHEN 'DEAL_APPROVED'  THEN 'DEAL_VERIFIED'
    WHEN 'DEAL_REJECTED'  THEN 'DEAL_PUT_ON_HOLD'
    ELSE action
END
WHERE action IN ('DEAL_SUBMITTED','DEAL_ASSIGNED','DEAL_APPROVED','DEAL_REJECTED');

/* ---------- 6. property country ---------- */

-- The property's country is now derived from deal → branch → firm and set server-side;
-- PropertyInput.country is gone, so a client can no longer name it. That makes this column a
-- copy of real_estate_firm.country, and it should have that column's shape (V25,
-- chk_ref_country).
--
-- V4 created it as VARCHAR(3) when the plan was ISO alpha-3 and NZ was the only option. Nothing
-- ever wrote a three-character value, but the backfill is here so a hand-edited 'NZL' cannot
-- fail the type change.
UPDATE property SET country = 'NZ' WHERE country IS NULL OR country NOT IN ('NZ','AU');

ALTER TABLE property ALTER COLUMN country TYPE VARCHAR(2);
-- The default backfilled V4's rows and then had no further job. The application is the only
-- thing that should decide a property's country now — same reasoning as V25's own DROP DEFAULT.
ALTER TABLE property ALTER COLUMN country DROP DEFAULT;
ALTER TABLE property ADD CONSTRAINT chk_property_country CHECK (country IN ('NZ','AU'));
