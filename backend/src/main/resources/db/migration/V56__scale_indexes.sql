-- Keeps list and search queries flat as the platform grows (perf/reports/2026-10-06-scale-500k.md).
-- Measured on 500k deals: with 20 firms of ~25k deals each, the deals list page sorted the whole
-- firm (46 ms), and owner search gathered every matching name on the platform before filtering to
-- the caller's firm (375 ms, growing with the platform even when firms stay the same size).

-- 1. Deals list: walk a branch's (or the platform's) deals already in display order and stop after
--    the page, instead of fetching every deal in scope and sorting it. One index per sort key the
--    list offers (DealListQuery.Sort), plus a platform-wide one the planner uses for firm scope.
CREATE INDEX IF NOT EXISTS idx_deal_branch_created ON deal (firm_branch_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_deal_branch_updated ON deal (firm_branch_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_deal_created ON deal (created_at DESC, id DESC);

-- 2. Owners carry their reporting entity, so the register and owner search can be scoped by an
--    index rather than by joining through every structure and deal first.
--
--    Maintained by triggers rather than application code: owners are created on several paths
--    (manual add, the trust node created automatically, copying an owner from another deal), and a
--    trigger cannot be forgotten by the next one. Hibernate does not map the column; it is
--    database-owned, like a generated column that needs a join.
ALTER TABLE ownership_node ADD COLUMN IF NOT EXISTS real_estate_firm_id BIGINT REFERENCES real_estate_firm (id);

UPDATE ownership_node n
   SET real_estate_firm_id = fb.real_estate_firm_id
  FROM ownership_structure s
  JOIN deal d ON d.id = s.deal_id
  JOIN firm_branch fb ON fb.id = d.firm_branch_id
 WHERE s.id = n.ownership_structure_id;

-- A new owner, or one moved to another structure, takes the firm of the deal it now stands on.
CREATE OR REPLACE FUNCTION ownership_node_set_firm() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT fb.real_estate_firm_id INTO NEW.real_estate_firm_id
    FROM ownership_structure s
    JOIN deal d ON d.id = s.deal_id
    JOIN firm_branch fb ON fb.id = d.firm_branch_id
   WHERE s.id = NEW.ownership_structure_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ownership_node_set_firm
  BEFORE INSERT OR UPDATE OF ownership_structure_id ON ownership_node
  FOR EACH ROW EXECUTE FUNCTION ownership_node_set_firm();

-- A deal moved to another branch (possibly another firm) moves its owners with it.
CREATE OR REPLACE FUNCTION deal_sync_owner_firm() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ownership_node n
     SET real_estate_firm_id = (SELECT fb.real_estate_firm_id FROM firm_branch fb WHERE fb.id = NEW.firm_branch_id)
    FROM ownership_structure s
   WHERE s.id = n.ownership_structure_id AND s.deal_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_deal_sync_owner_firm
  AFTER UPDATE OF firm_branch_id ON deal
  FOR EACH ROW WHEN (OLD.firm_branch_id IS DISTINCT FROM NEW.firm_branch_id)
  EXECUTE FUNCTION deal_sync_owner_firm();

-- A branch moved to another firm moves the owners on all its deals.
CREATE OR REPLACE FUNCTION firm_branch_sync_owner_firm() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ownership_node n
     SET real_estate_firm_id = NEW.real_estate_firm_id
    FROM ownership_structure s
    JOIN deal d ON d.id = s.deal_id
   WHERE s.id = n.ownership_structure_id AND d.firm_branch_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_firm_branch_sync_owner_firm
  AFTER UPDATE OF real_estate_firm_id ON firm_branch
  FOR EACH ROW WHEN (OLD.real_estate_firm_id IS DISTINCT FROM NEW.real_estate_firm_id)
  EXECUTE FUNCTION firm_branch_sync_owner_firm();

-- A firm's owners straight off the index: the register page, and owner search, which filters the
-- names of just that firm's owners (IndividualQuery) instead of gathering every matching name on
-- the platform. Measured at 500k deals / 200 firms: owner search 106 ms -> 15 ms. A composite
-- (firm, name) trigram GIN index was tried and was slower (38 ms): a multi-column GIN index does
-- not narrow by the firm column well, and a firm's owners are few enough to check directly. The
-- name-only trigram index from V54 stays for platform-wide (ROOT) searches.
CREATE INDEX IF NOT EXISTS idx_ownership_node_firm_id ON ownership_node (real_estate_firm_id, id DESC);
