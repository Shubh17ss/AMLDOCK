-- Off-boarding: when a reporting entity or branch was switched off, and why.
--
-- deactivated_at starts the retention hold (RetentionPolicy): 5 years for an NZ entity, 7 for an
-- AU one, during which nothing in it may be deleted — not even by ROOT. A branch takes its
-- jurisdiction from its entity's country.
--
-- deactivation_source records what switched a row off, so switching the cause back on restores
-- only what it switched off itself:
--   MANUAL — someone switched this row off directly
--   BRANCH — a membership switched off because its branch was deactivated
--   FIRM   — a branch switched off because its entity was deactivated
-- A branch someone deactivated by hand stays off when its entity comes back, and so does a
-- membership a manager deactivated by hand when its branch comes back.

ALTER TABLE real_estate_firm ADD COLUMN deactivated_at TIMESTAMPTZ NULL;

ALTER TABLE firm_branch ADD COLUMN deactivated_at      TIMESTAMPTZ NULL;
ALTER TABLE firm_branch ADD COLUMN deactivation_source VARCHAR(10) NULL;
ALTER TABLE firm_branch
    ADD CONSTRAINT chk_firm_branch_deactivation_source
        CHECK (deactivation_source IS NULL OR deactivation_source IN ('MANUAL', 'FIRM'));

ALTER TABLE firm_membership ADD COLUMN deactivation_source VARCHAR(10) NULL;
ALTER TABLE firm_membership
    ADD CONSTRAINT chk_firm_membership_deactivation_source
        CHECK (deactivation_source IS NULL OR deactivation_source IN ('MANUAL', 'BRANCH', 'FIRM'));

-- Rows already off were switched off by hand — nothing cascaded before this migration. Their hold
-- starts now: when they were really switched off was never recorded, and starting it earlier
-- could make data deletable sooner than the law allows.
UPDATE real_estate_firm SET deactivated_at = NOW() WHERE NOT is_active;
UPDATE firm_branch      SET deactivated_at = NOW(), deactivation_source = 'MANUAL' WHERE NOT is_active;
UPDATE firm_membership  SET deactivation_source = 'MANUAL' WHERE NOT is_active;

-- V56 added ownership_node.real_estate_firm_id with no ON DELETE action, which would block
-- deleting an entity. The node is the entity's data and goes with it. The constraint was named by
-- Postgres, so it is looked up rather than assumed.
DO $$
DECLARE fk_name TEXT;
BEGIN
    SELECT con.conname INTO fk_name
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.conrelid = 'ownership_node'::regclass
       AND con.contype = 'f'
       AND att.attname = 'real_estate_firm_id';
    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ownership_node DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

ALTER TABLE ownership_node
    ADD CONSTRAINT fk_ownership_node_firm FOREIGN KEY (real_estate_firm_id)
        REFERENCES real_estate_firm(id) ON DELETE CASCADE;
