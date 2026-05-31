-- Brokers are now scoped to a single firm AND a single branch.
--   BROKER       → real_estate_firm_id NOT NULL, firm_branch_id NOT NULL
--   FIRM_USER    → real_estate_firm_id NOT NULL, firm_branch_id NULL  (sees all branches)
--   COMPLIANCE / MANAGER → both NULL (internal staff, not scoped to a firm)
--
-- This migration self-heals legacy BROKER rows that were created under the old schema
-- (which permitted firm_id = NULL for brokers): they get auto-assigned to the first
-- active firm + branch pair so the new CHECK doesn't reject the migration.
-- If no active firm/branch exists, the migration raises a helpful message instead of
-- the cryptic "check constraint violated by some row".

ALTER TABLE app_user
    ADD COLUMN firm_branch_id BIGINT;

ALTER TABLE app_user
    ADD CONSTRAINT fk_app_user_branch
        FOREIGN KEY (firm_branch_id) REFERENCES firm_branch(id) ON DELETE RESTRICT;

CREATE INDEX idx_app_user_firm_branch ON app_user(firm_branch_id);

-- Replace the old "FIRM_USER ⇔ has firm" check with per-role rules.
ALTER TABLE app_user
    DROP CONSTRAINT chk_firm_user_has_firm;

-- Self-heal legacy BROKER rows before installing the strict CHECK.
DO $$
DECLARE
    default_firm_id   BIGINT;
    default_branch_id BIGINT;
    orphan_count      INT;
BEGIN
    SELECT COUNT(*) INTO orphan_count
      FROM app_user
     WHERE role = 'BROKER'
       AND (real_estate_firm_id IS NULL OR firm_branch_id IS NULL);

    IF orphan_count > 0 THEN
        SELECT b.real_estate_firm_id, b.id
          INTO default_firm_id, default_branch_id
          FROM firm_branch b
          JOIN real_estate_firm f ON f.id = b.real_estate_firm_id
         WHERE b.is_active AND f.is_active
         ORDER BY b.id ASC
         LIMIT 1;

        IF default_branch_id IS NULL THEN
            RAISE EXCEPTION
              'V8 cannot apply: % BROKER user(s) exist without a firm/branch and no active firm + branch is available to assign them to. Create an active firm with at least one active branch first, OR delete/repoint those broker accounts.',
              orphan_count;
        END IF;

        UPDATE app_user
           SET real_estate_firm_id = default_firm_id,
               firm_branch_id      = default_branch_id
         WHERE role = 'BROKER'
           AND (real_estate_firm_id IS NULL OR firm_branch_id IS NULL);

        RAISE NOTICE
          'V8: auto-assigned % legacy BROKER row(s) to firm % / branch %. Reassign via /admin/users if needed.',
          orphan_count, default_firm_id, default_branch_id;
    END IF;
END $$;

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_role_links CHECK (
        (role = 'BROKER'
            AND real_estate_firm_id IS NOT NULL
            AND firm_branch_id IS NOT NULL)
     OR (role = 'FIRM_USER'
            AND real_estate_firm_id IS NOT NULL
            AND firm_branch_id IS NULL)
     OR (role IN ('COMPLIANCE', 'MANAGER')
            AND real_estate_firm_id IS NULL
            AND firm_branch_id IS NULL)
    );
