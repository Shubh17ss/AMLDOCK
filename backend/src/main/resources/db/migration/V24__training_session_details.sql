-- Training sessions get a description, and the optional "due date" becomes a required session
-- date — a session happens on a day, it isn't a deadline. Certified minutes are dropped: the
-- distinction was never used, and total minutes alone is what gets reported.

ALTER TABLE training_session
    ADD COLUMN description TEXT;

ALTER TABLE training_session
    RENAME COLUMN due_date TO session_date;

-- Existing sessions may have had no due date at all. Fall back to the day the session was
-- recorded so nothing is invented, then close the column off.
UPDATE training_session
SET session_date = created_at::date
WHERE session_date IS NULL;

ALTER TABLE training_session
    ALTER COLUMN session_date SET NOT NULL;

ALTER INDEX idx_ts_due RENAME TO idx_ts_date;

-- Postgres drops the CHECKs that reference the column with it, but naming them keeps this
-- readable and re-runnable against a hand-patched database.
ALTER TABLE training_session
    DROP CONSTRAINT IF EXISTS chk_ts_minutes,
    DROP CONSTRAINT IF EXISTS chk_ts_certified;

ALTER TABLE training_session
    DROP COLUMN certified_minutes;
