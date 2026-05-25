-- M2: real-estate firms + branches.

CREATE TABLE real_estate_firm (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL UNIQUE,
    trading_name        VARCHAR(255),
    nzbn                VARCHAR(32),
    head_office_address TEXT,
    contact_email       VARCHAR(255),
    contact_phone       VARCHAR(64),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE firm_branch (
    id                  BIGSERIAL PRIMARY KEY,
    real_estate_firm_id BIGINT NOT NULL,
    name                VARCHAR(255) NOT NULL,
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    suburb              VARCHAR(128),
    city                VARCHAR(128),
    postcode            VARCHAR(16),
    phone               VARCHAR(64),
    email               VARCHAR(255),
    manager_name        VARCHAR(255),
    manager_email       VARCHAR(255),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_branch_firm FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE RESTRICT,
    CONSTRAINT uq_branch_firm_name UNIQUE (real_estate_firm_id, name)
);

CREATE INDEX idx_firm_branch_firm ON firm_branch(real_estate_firm_id);

-- Now that real_estate_firm exists, enforce the app_user FK.
ALTER TABLE app_user
    ADD CONSTRAINT fk_app_user_firm
        FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE RESTRICT;
