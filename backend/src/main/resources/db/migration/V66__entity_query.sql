-- Workspace > Queries: a change a reporting entity's staff ask the AMLDOCK admin team to make to
-- details they may not edit themselves (name, NZBN/ABN, country, branch count). Raised from
-- Settings > Reporting Entity, worked through by ROOT, and deleted outright once done with.
--
-- The raiser's name and email are copied onto the row so it still reads correctly after the user
-- is renamed or removed; the user id is kept only as a link and goes null with the user.
CREATE TABLE entity_query (
    id                  BIGSERIAL PRIMARY KEY,
    real_estate_firm_id BIGINT       NOT NULL,
    raised_by_user_id   BIGINT,
    raised_by_name      VARCHAR(255),
    raised_by_email     VARCHAR(255) NOT NULL,
    message             TEXT         NOT NULL,
    status              VARCHAR(16)  NOT NULL DEFAULT 'OPEN',
    resolved_at         TIMESTAMPTZ,
    resolved_by_user_id BIGINT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_eq_firm     FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_eq_raiser   FOREIGN KEY (raised_by_user_id)   REFERENCES app_user(id)         ON DELETE SET NULL,
    CONSTRAINT fk_eq_resolver FOREIGN KEY (resolved_by_user_id) REFERENCES app_user(id)         ON DELETE SET NULL,
    CONSTRAINT chk_eq_status  CHECK (status IN ('OPEN','RESOLVED'))
);

CREATE INDEX idx_entity_query_status_created ON entity_query (status, created_at DESC);
