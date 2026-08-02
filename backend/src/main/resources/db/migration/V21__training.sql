-- AML Training > Staff Training. Three tables, scoped to a firm and branch like the monitoring
-- registers (V20__suspicious_activity.sql):
--   training_provider          — who delivers the training
--   training_session           — one session run for a branch
--   training_session_attendee  — the assignment join row, in the style of ownership_edge

CREATE TABLE training_provider (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    real_estate_firm_id BIGINT,
    firm_branch_id      BIGINT,
    created_by_user_id  BIGINT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tp_firm    FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_tp_branch  FOREIGN KEY (firm_branch_id)      REFERENCES firm_branch(id)      ON DELETE SET NULL,
    CONSTRAINT fk_tp_creator FOREIGN KEY (created_by_user_id)  REFERENCES app_user(id)         ON DELETE RESTRICT
);

CREATE INDEX idx_tp_firm_branch ON training_provider(real_estate_firm_id, firm_branch_id);

CREATE TABLE training_session (
    id                   BIGSERIAL PRIMARY KEY,
    name                 VARCHAR(512)  NOT NULL,
    location             VARCHAR(512)  NOT NULL,
    url                  VARCHAR(1024),
    training_provider_id BIGINT        NOT NULL,
    due_date             DATE,
    total_minutes        INTEGER       NOT NULL,
    -- The share of the total that counts towards certification.
    certified_minutes    INTEGER       NOT NULL,
    real_estate_firm_id  BIGINT,
    firm_branch_id       BIGINT,
    created_by_user_id   BIGINT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ts_firm     FOREIGN KEY (real_estate_firm_id)  REFERENCES real_estate_firm(id)   ON DELETE CASCADE,
    CONSTRAINT fk_ts_branch   FOREIGN KEY (firm_branch_id)       REFERENCES firm_branch(id)        ON DELETE SET NULL,
    CONSTRAINT fk_ts_creator  FOREIGN KEY (created_by_user_id)   REFERENCES app_user(id)           ON DELETE RESTRICT,
    -- RESTRICT: a provider still in use may not be deleted out from under its sessions.
    CONSTRAINT fk_ts_provider FOREIGN KEY (training_provider_id) REFERENCES training_provider(id)  ON DELETE RESTRICT,
    CONSTRAINT chk_ts_total     CHECK (total_minutes >= 0),
    CONSTRAINT chk_ts_certified CHECK (certified_minutes >= 0),
    CONSTRAINT chk_ts_minutes   CHECK (certified_minutes <= total_minutes)
);

CREATE INDEX idx_ts_firm_branch ON training_session(real_estate_firm_id, firm_branch_id);
CREATE INDEX idx_ts_due         ON training_session(due_date);
CREATE INDEX idx_ts_provider    ON training_session(training_provider_id);

-- One row per assigned staff member. completed_at NULL means "not completed yet"; there is no
-- separate status column. Assignment is restricted to branch-level staff of the session's
-- branch — enforced in TrainingSessionService, since the role lives on app_user.
CREATE TABLE training_session_attendee (
    id                  BIGSERIAL PRIMARY KEY,
    training_session_id BIGINT NOT NULL,
    user_id             BIGINT NOT NULL,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tsa_session FOREIGN KEY (training_session_id) REFERENCES training_session(id) ON DELETE CASCADE,
    CONSTRAINT fk_tsa_user    FOREIGN KEY (user_id)             REFERENCES app_user(id)         ON DELETE RESTRICT,
    CONSTRAINT uq_tsa_session_user UNIQUE (training_session_id, user_id)
);

CREATE INDEX idx_tsa_session ON training_session_attendee(training_session_id);
CREATE INDEX idx_tsa_user    ON training_session_attendee(user_id);
