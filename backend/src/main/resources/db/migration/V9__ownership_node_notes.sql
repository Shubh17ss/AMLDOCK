-- Per-node free-text notes:
--   notes              → general commentary about the node (any tab)
--   verification_notes → reasoning behind the manual verification mark
--
-- Verification status default flips to IN_PROGRESS so newly created nodes show as
-- "Under verification" until someone marks otherwise. Existing NOT_STARTED rows are
-- migrated so the UI's three-state picker (Verified / Under verification / Not verified)
-- never lands on a stale value.

ALTER TABLE ownership_node
    ADD COLUMN notes TEXT;

ALTER TABLE ownership_node
    ADD COLUMN verification_notes TEXT;

ALTER TABLE ownership_node
    ALTER COLUMN verification_status SET DEFAULT 'IN_PROGRESS';

UPDATE ownership_node
   SET verification_status = 'IN_PROGRESS'
 WHERE verification_status = 'NOT_STARTED';
