-- Monitoring > International Fund Transaction Register: one row per international fund
-- transfer tied to a listing, scoped to a firm and (optionally) a branch. Each entry may
-- carry one supporting PDF, stored in S3 via the same presigned flow as compliance
-- documents — the columns here are the register, not the bytes.

CREATE TABLE international_fund_transaction (
    id                    BIGSERIAL PRIMARY KEY,
    deal_reference        VARCHAR(255),
    listing_address       VARCHAR(512)  NOT NULL,
    transaction_flow      VARCHAR(16)   NOT NULL,
    transaction_date      DATE          NOT NULL,
    amount_nzd            NUMERIC(18,2) NOT NULL,
    overseas_jurisdiction VARCHAR(2)    NOT NULL,   -- ISO 3166-1 alpha-2
    submission_reference  VARCHAR(255),
    -- Optional single PDF attachment. All five columns stay NULL until an upload is
    -- presigned (PENDING), then flip to ACTIVE once the object is confirmed in S3.
    s3_key                VARCHAR(1024) UNIQUE,
    original_filename     VARCHAR(512),
    content_type          VARCHAR(255),
    size_bytes            BIGINT,
    document_status       VARCHAR(32),
    real_estate_firm_id   BIGINT,
    firm_branch_id        BIGINT,
    created_by_user_id    BIGINT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ift_firm    FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_ift_branch  FOREIGN KEY (firm_branch_id)      REFERENCES firm_branch(id)      ON DELETE SET NULL,
    CONSTRAINT fk_ift_creator FOREIGN KEY (created_by_user_id)  REFERENCES app_user(id)         ON DELETE RESTRICT,
    CONSTRAINT chk_ift_flow      CHECK (transaction_flow IN ('INWARDS','OUTWARDS')),
    CONSTRAINT chk_ift_docstatus CHECK (document_status IS NULL OR document_status IN ('PENDING','ACTIVE','DELETED')),
    CONSTRAINT chk_ift_amount    CHECK (amount_nzd >= 0)
);

CREATE INDEX idx_ift_firm_branch ON international_fund_transaction(real_estate_firm_id, firm_branch_id);
CREATE INDEX idx_ift_date        ON international_fund_transaction(transaction_date DESC);
CREATE INDEX idx_ift_creator     ON international_fund_transaction(created_by_user_id);
