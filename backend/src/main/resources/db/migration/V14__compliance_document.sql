-- Firm-level compliance documents (Risk Assessment / Compliance Programme / Annual Report):
-- versioned uploads per firm + category. Bytes live in S3; this is the version register.

CREATE TABLE compliance_document (
    id                  BIGSERIAL PRIMARY KEY,
    category            VARCHAR(64) NOT NULL,
    name                VARCHAR(512) NOT NULL,
    change_notes        TEXT,
    version_no          INT NOT NULL,
    s3_key              VARCHAR(1024) NOT NULL UNIQUE,
    original_filename   VARCHAR(512) NOT NULL,
    content_type        VARCHAR(255) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    real_estate_firm_id BIGINT,
    uploaded_by_user_id BIGINT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_compdoc_firm     FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_compdoc_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user(id) ON DELETE RESTRICT,
    CONSTRAINT chk_compdoc_status   CHECK (status IN ('PENDING','ACTIVE','DELETED')),
    CONSTRAINT chk_compdoc_category CHECK (category IN (
        'RISK_ASSESSMENT','COMPLIANCE_PROGRAMME','ANNUAL_REPORT'
    ))
);

CREATE INDEX idx_compdoc_firm_category ON compliance_document(real_estate_firm_id, category);
CREATE INDEX idx_compdoc_uploader      ON compliance_document(uploaded_by_user_id);
