-- M4: document table. OCR columns added now but no OCR runs until M5.

CREATE TABLE document (
    id                  BIGSERIAL PRIMARY KEY,
    s3_key              VARCHAR(1024) NOT NULL UNIQUE,
    original_filename   VARCHAR(512) NOT NULL,
    content_type        VARCHAR(255) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    document_type       VARCHAR(64) NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    deal_id             BIGINT,
    uploaded_by_user_id BIGINT NOT NULL,
    ocr_status          VARCHAR(32) NOT NULL DEFAULT 'NOT_APPLICABLE',
    ocr_provider        VARCHAR(64),
    ocr_raw_text        TEXT,
    ocr_fields          JSONB,
    ocr_confidence      NUMERIC(4,3),
    ocr_completed_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_document_deal     FOREIGN KEY (deal_id)             REFERENCES deal(id)     ON DELETE CASCADE,
    CONSTRAINT fk_document_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user(id) ON DELETE RESTRICT,
    CONSTRAINT chk_document_status CHECK (status IN ('PENDING','ACTIVE','DELETED')),
    CONSTRAINT chk_document_type CHECK (document_type IN (
        'DRIVER_LICENCE','PASSPORT','TRUST_DEED','COMPANY_CERT','TITLE_DOC','SALE_AGREEMENT','OTHER'
    )),
    CONSTRAINT chk_document_ocr_status CHECK (ocr_status IN (
        'NOT_APPLICABLE','PENDING','DONE','FAILED'
    )),
    CONSTRAINT chk_document_owner CHECK (deal_id IS NOT NULL)
);

CREATE INDEX idx_document_deal      ON document(deal_id);
CREATE INDEX idx_document_uploader  ON document(uploaded_by_user_id);
CREATE INDEX idx_document_ocr_pending ON document(ocr_status) WHERE ocr_status = 'PENDING';
