-- Monitoring > Suspicious Activity Register: one row per potential suspicion raised by staff,
-- scoped to a firm and (optionally) a branch. Each entry may carry one supporting PDF, stored
-- in S3 via the same presigned flow as compliance documents — the columns here are the
-- register, not the bytes. Modelled on V17__international_fund_transaction.sql.

CREATE TABLE suspicious_activity (
    id                  BIGSERIAL PRIMARY KEY,
    suspicion_type      VARCHAR(16)   NOT NULL,
    -- Only meaningful for a TRANSACTION; the service nulls it out for an ACTIVITY.
    amount_nzd          NUMERIC(18,2),
    name                VARCHAR(512)  NOT NULL,
    date_of_suspicion   DATE          NOT NULL,
    -- Deliberately no CHECK: the red-flag taxonomy lives in the RedFlag enum and is meant to
    -- grow in code without a migration, the same way V18 freed document_review.module_key.
    red_flag            VARCHAR(64)   NOT NULL,
    reference           VARCHAR(255),
    description         TEXT          NOT NULL,
    action_taken        TEXT,
    -- Optional single PDF attachment. All five columns stay NULL until an upload is
    -- presigned (PENDING), then flip to ACTIVE once the object is confirmed in S3.
    s3_key              VARCHAR(1024) UNIQUE,
    original_filename   VARCHAR(512),
    content_type        VARCHAR(255),
    size_bytes          BIGINT,
    document_status     VARCHAR(32),
    real_estate_firm_id BIGINT,
    firm_branch_id      BIGINT,
    created_by_user_id  BIGINT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_sa_firm    FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_branch  FOREIGN KEY (firm_branch_id)      REFERENCES firm_branch(id)      ON DELETE SET NULL,
    CONSTRAINT fk_sa_creator FOREIGN KEY (created_by_user_id)  REFERENCES app_user(id)         ON DELETE RESTRICT,
    CONSTRAINT chk_sa_type       CHECK (suspicion_type IN ('ACTIVITY','TRANSACTION')),
    CONSTRAINT chk_sa_docstatus  CHECK (document_status IS NULL OR document_status IN ('PENDING','ACTIVE','DELETED')),
    CONSTRAINT chk_sa_amount     CHECK (amount_nzd IS NULL OR amount_nzd >= 0),
    -- An amount is required for a transaction and meaningless without one.
    CONSTRAINT chk_sa_txn_amount CHECK (suspicion_type <> 'TRANSACTION' OR amount_nzd IS NOT NULL)
);

CREATE INDEX idx_sa_firm_branch ON suspicious_activity(real_estate_firm_id, firm_branch_id);
CREATE INDEX idx_sa_date        ON suspicious_activity(date_of_suspicion DESC);
CREATE INDEX idx_sa_creator     ON suspicious_activity(created_by_user_id);
