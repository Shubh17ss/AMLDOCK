-- M3: property, client, deal.

CREATE TABLE property (
    id                  BIGSERIAL PRIMARY KEY,
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    suburb              VARCHAR(128),
    city                VARCHAR(128),
    postcode            VARCHAR(16),
    title_reference     VARCHAR(128),
    legal_description   TEXT,
    land_area_sqm       NUMERIC(12,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE client (
    id                  BIGSERIAL PRIMARY KEY,
    display_name        VARCHAR(255) NOT NULL,
    client_type         VARCHAR(32)  NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(64),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_client_type CHECK (client_type IN ('INDIVIDUAL', 'ENTITY'))
);

CREATE TABLE deal (
    id                          BIGSERIAL PRIMARY KEY,
    reference                   VARCHAR(64) UNIQUE,
    firm_branch_id              BIGINT NOT NULL,
    property_id                 BIGINT NOT NULL,
    client_id                   BIGINT NOT NULL,
    status                      VARCHAR(32) NOT NULL,
    transaction_type            VARCHAR(32) NOT NULL,
    transaction_value_nzd       NUMERIC(15,2),
    poc_name                    VARCHAR(255),
    poc_role                    VARCHAR(128),
    poc_phone                   VARCHAR(64),
    poc_email                   VARCHAR(255),
    created_by_user_id          BIGINT NOT NULL,
    assigned_compliance_user_id BIGINT,
    decision_notes              TEXT,
    decided_by_user_id          BIGINT,
    decided_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_deal_branch    FOREIGN KEY (firm_branch_id)              REFERENCES firm_branch(id)    ON DELETE RESTRICT,
    CONSTRAINT fk_deal_property  FOREIGN KEY (property_id)                 REFERENCES property(id)       ON DELETE RESTRICT,
    CONSTRAINT fk_deal_client    FOREIGN KEY (client_id)                   REFERENCES client(id)         ON DELETE RESTRICT,
    CONSTRAINT fk_deal_creator   FOREIGN KEY (created_by_user_id)          REFERENCES app_user(id)       ON DELETE RESTRICT,
    CONSTRAINT fk_deal_assignee  FOREIGN KEY (assigned_compliance_user_id) REFERENCES app_user(id)       ON DELETE SET NULL,
    CONSTRAINT fk_deal_decider   FOREIGN KEY (decided_by_user_id)          REFERENCES app_user(id)       ON DELETE SET NULL,
    CONSTRAINT chk_deal_status CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
    CONSTRAINT chk_deal_txn_type CHECK (transaction_type IN ('PURCHASE','SALE'))
);

CREATE INDEX idx_deal_status                 ON deal(status);
CREATE INDEX idx_deal_firm_branch            ON deal(firm_branch_id);
CREATE INDEX idx_deal_created_by             ON deal(created_by_user_id);
CREATE INDEX idx_deal_assigned_compliance    ON deal(assigned_compliance_user_id);
