-- AML Training > Courses: the self-paced counterpart to training_session (V21__training.sql).
-- A course is material plus a questionnaire, assigned to branch staff:
--   training_course                  — name, description, due date, pass mark
--   training_course_file             — content, one row per file, ANY content type
--   training_course_question         — the questionnaire, ordered by position
--   training_course_question_option  — answer options, with the answer key
--   training_course_assignee         — who has to take it

CREATE TABLE training_course (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(512) NOT NULL,
    description         TEXT,
    due_date            DATE,
    -- The score a taker must reach to pass, as a whole percentage.
    pass_mark_percent   INTEGER NOT NULL,
    real_estate_firm_id BIGINT,
    firm_branch_id      BIGINT,
    created_by_user_id  BIGINT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tc_firm    FOREIGN KEY (real_estate_firm_id) REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT fk_tc_branch  FOREIGN KEY (firm_branch_id)      REFERENCES firm_branch(id)      ON DELETE SET NULL,
    CONSTRAINT fk_tc_creator FOREIGN KEY (created_by_user_id)  REFERENCES app_user(id)         ON DELETE RESTRICT,
    CONSTRAINT chk_tc_pass_mark CHECK (pass_mark_percent BETWEEN 1 AND 100)
);

CREATE INDEX idx_tc_firm_branch ON training_course(real_estate_firm_id, firm_branch_id);
CREATE INDEX idx_tc_due         ON training_course(due_date);

-- Course material. Deliberately NO content-type restriction: slides, spreadsheets, images and
-- video are all legitimate training material. Only the size cap in the service applies.
CREATE TABLE training_course_file (
    id                  BIGSERIAL PRIMARY KEY,
    training_course_id  BIGINT NOT NULL,
    s3_key              VARCHAR(1024) UNIQUE,
    original_filename   VARCHAR(512),
    content_type        VARCHAR(255),
    size_bytes          BIGINT,
    document_status     VARCHAR(32),
    uploaded_by_user_id BIGINT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tcf_course   FOREIGN KEY (training_course_id)  REFERENCES training_course(id) ON DELETE CASCADE,
    CONSTRAINT fk_tcf_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user(id)        ON DELETE RESTRICT,
    CONSTRAINT chk_tcf_docstatus CHECK (document_status IS NULL OR document_status IN ('PENDING','ACTIVE','DELETED'))
);

CREATE INDEX idx_tcf_course ON training_course_file(training_course_id);

-- Both question types are auto-scorable; a free-text type was deliberately left out, so unlike
-- suspicious_activity.red_flag this list IS closed and carries a CHECK.
CREATE TABLE training_course_question (
    id                 BIGSERIAL PRIMARY KEY,
    training_course_id BIGINT      NOT NULL,
    position           INTEGER     NOT NULL,
    question_type      VARCHAR(32) NOT NULL,
    prompt             TEXT        NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tcq_course FOREIGN KEY (training_course_id) REFERENCES training_course(id) ON DELETE CASCADE,
    CONSTRAINT chk_tcq_type CHECK (question_type IN ('SINGLE_CHOICE','MULTI_CHOICE')),
    CONSTRAINT uq_tcq_course_position UNIQUE (training_course_id, position)
);

CREATE INDEX idx_tcq_course ON training_course_question(training_course_id);

CREATE TABLE training_course_question_option (
    id          BIGSERIAL PRIMARY KEY,
    question_id BIGINT  NOT NULL,
    position    INTEGER NOT NULL,
    label       TEXT    NOT NULL,
    -- The answer key. Stripped from the payload for anyone who isn't a training manager.
    correct     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tcqo_question FOREIGN KEY (question_id) REFERENCES training_course_question(id) ON DELETE CASCADE,
    CONSTRAINT uq_tcqo_question_position UNIQUE (question_id, position)
);

CREATE INDEX idx_tcqo_question ON training_course_question_option(question_id);

-- completed_at stays NULL until the course-taker side is built.
CREATE TABLE training_course_assignee (
    id                 BIGSERIAL PRIMARY KEY,
    training_course_id BIGINT NOT NULL,
    user_id            BIGINT NOT NULL,
    completed_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tca_course FOREIGN KEY (training_course_id) REFERENCES training_course(id) ON DELETE CASCADE,
    CONSTRAINT fk_tca_user   FOREIGN KEY (user_id)            REFERENCES app_user(id)        ON DELETE RESTRICT,
    CONSTRAINT uq_tca_course_user UNIQUE (training_course_id, user_id)
);

CREATE INDEX idx_tca_course ON training_course_assignee(training_course_id);
CREATE INDEX idx_tca_user   ON training_course_assignee(user_id);
