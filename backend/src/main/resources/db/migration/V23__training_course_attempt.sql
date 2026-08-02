-- The course-taker side: record how each assigned staff member did on the assessment.
--
-- completed_at (from V22) keeps its meaning — set when, and only when, they pass. score_percent
-- and passed are nullable because NULL means "never attempted", which the UI shows differently
-- from a recorded fail. Retakes are unlimited, so these hold the LATEST attempt.

ALTER TABLE training_course_assignee
    ADD COLUMN score_percent   INTEGER,
    ADD COLUMN passed          BOOLEAN,
    ADD COLUMN attempt_count   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_attempt_at TIMESTAMPTZ;

ALTER TABLE training_course_assignee
    ADD CONSTRAINT chk_tca_score CHECK (score_percent IS NULL OR score_percent BETWEEN 0 AND 100);
