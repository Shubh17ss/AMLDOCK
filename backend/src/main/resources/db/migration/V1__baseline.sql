-- Baseline schema for AML_DOCK MVP-1 milestone M1.
-- Tables created here: app_user, audit_log.

CREATE TABLE app_user (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(32)  NOT NULL,
    real_estate_firm_id BIGINT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_app_user_role CHECK (role IN ('BROKER','COMPLIANCE','MANAGER','FIRM_USER')),
    CONSTRAINT chk_firm_user_has_firm CHECK (
        (role = 'FIRM_USER' AND real_estate_firm_id IS NOT NULL)
        OR (role <> 'FIRM_USER' AND real_estate_firm_id IS NULL)
    )
);

CREATE INDEX idx_app_user_real_estate_firm_id ON app_user(real_estate_firm_id);

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    actor_user_id   BIGINT NULL,
    actor_email     VARCHAR(255),
    action          VARCHAR(64) NOT NULL,
    entity_type     VARCHAR(64),
    entity_id       BIGINT,
    summary         TEXT,
    metadata        JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES app_user(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_actor_created ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

CREATE TABLE refresh_token (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_token_user ON refresh_token(user_id);
CREATE INDEX idx_refresh_token_expires ON refresh_token(expires_at);
