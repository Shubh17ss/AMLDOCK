-- Per-register review schedule: each compliance document register (category), scoped to a
-- firm and optional branch, tracks the next review due date and when it was last marked
-- complete. Drives the review-status indicator (unset / overdue / on-track) on the cards.

CREATE TABLE document_review (
    id                       BIGSERIAL PRIMARY KEY,
    category                 VARCHAR(64) NOT NULL,
    real_estate_firm_id      BIGINT,
    firm_branch_id           BIGINT,
    next_review_date         DATE,
    last_completed_at        TIMESTAMPTZ,
    last_completed_by_user_id BIGINT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_docreview_firm     FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_docreview_branch   FOREIGN KEY (firm_branch_id) REFERENCES firm_branch(id) ON DELETE CASCADE,
    CONSTRAINT fk_docreview_completer FOREIGN KEY (last_completed_by_user_id) REFERENCES app_user(id) ON DELETE SET NULL,
    CONSTRAINT chk_docreview_category CHECK (category IN (
        'RISK_ASSESSMENT','COMPLIANCE_PROGRAMME','ANNUAL_REPORT'
    ))
);

-- One review row per scope (firm + branch + category). COALESCE folds the NULL firm
-- (platform register) and NULL branch (firm-wide register) into concrete keys so those
-- scopes get a single row each rather than unbounded NULL-distinct duplicates.
CREATE UNIQUE INDEX uq_docreview_scope
    ON document_review (COALESCE(real_estate_firm_id, -1), COALESCE(firm_branch_id, -1), category);
