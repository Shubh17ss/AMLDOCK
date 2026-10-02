/*
 * TWO CHANGES, ONE MIGRATION.
 *
 * 1. OWNERSHIP TENURE "TO BE CONFIRMED".
 *
 * A broker does not always know how long their client has held the property when the deal is
 * opened. Until now the only honest answer was to leave it blank, which reads as "not asked" and
 * holds up both the risk approval and the verification. ownership_tenure_tbc is the answer "asked,
 * and not known yet" - it scores +3 in DealRiskService, the same weight as a mid-length hold, so
 * the uncertainty is priced in rather than ignored.
 *
 * It excludes a figure: a deal is either TBC or has years/months, never both. The CHECK sits on
 * the live table only - deal_version was cloned EXCLUDING ALL in V41 and carries no constraints.
 *
 * THE PAIRED ALTER. DealFields is a @MappedSuperclass shared by Deal and DealVersion and Hibernate
 * runs ddl-auto: validate, so the column lands on both tables (see V49).
 *
 * 2. ASSURANCE: ACTION REQUIRED, WITH ITS ISSUES.
 *
 * V50 recorded assurance as ASSURED / UNASSURED with a single note. It becomes ASSURED /
 * ACTION_REQUIRED, and an action-required verdict carries its findings as rows - each an issue
 * identified and the remediation planned for it - rather than one block of prose. Assuring a
 * version removes its issues; the audit log keeps the history.
 *
 * The note goes. Assuring needs no explanation, and action required explains itself through its
 * issues. No data is converted: there are no deal versions at the time of writing.
 */

/* ---------- 1. tenure TBC ---------- */

ALTER TABLE deal
    ADD COLUMN ownership_tenure_tbc BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT chk_deal_tenure_tbc CHECK (
        NOT ownership_tenure_tbc
        OR (ownership_tenure_years IS NULL AND ownership_tenure_months IS NULL));

ALTER TABLE deal_version
    ADD COLUMN ownership_tenure_tbc BOOLEAN NOT NULL DEFAULT false;

/* ---------- 2. assurance ---------- */

ALTER TABLE deal_version
    DROP CONSTRAINT chk_deal_version_assurance_status,
    DROP CONSTRAINT chk_deal_version_assurance_record;

UPDATE deal_version SET assurance_status = 'ACTION_REQUIRED' WHERE assurance_status = 'UNASSURED';

ALTER TABLE deal_version
    DROP COLUMN assurance_note,
    ADD CONSTRAINT chk_deal_version_assurance_status CHECK (
        assurance_status IS NULL OR assurance_status IN ('ASSURED', 'ACTION_REQUIRED')),
    -- A verdict names who and when, or none of the three is set. Same reasoning as V50.
    ADD CONSTRAINT chk_deal_version_assurance_record CHECK (
        (assurance_status IS NULL AND assurance_by_user_id IS NULL AND assurance_at IS NULL)
     OR (assurance_status IS NOT NULL AND assurance_by_user_id IS NOT NULL AND assurance_at IS NOT NULL));

CREATE TABLE deal_version_assurance_issue (
    id              BIGSERIAL PRIMARY KEY,
    deal_version_id BIGINT NOT NULL REFERENCES deal_version(id) ON DELETE CASCADE,
    issue           TEXT   NOT NULL,
    remediation     TEXT   NOT NULL,
    sort_order      INT    NOT NULL,
    -- The 3-character floor matches every other free-text record in the file (V29, V50).
    CONSTRAINT chk_assurance_issue_text CHECK (length(btrim(issue)) >= 3),
    CONSTRAINT chk_assurance_remediation_text CHECK (length(btrim(remediation)) >= 3)
);

CREATE INDEX idx_assurance_issue_version ON deal_version_assurance_issue(deal_version_id, sort_order);
