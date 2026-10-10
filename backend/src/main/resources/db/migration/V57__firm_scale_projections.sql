-- Makes the remaining lists cost the same whatever the size of a firm
-- (perf/reports/2026-10-06-scale-500k.md, "big firms"). With 20 firms of ~25k deals each, three
-- queries still read every row in the firm: the assurance register (ordered by the latest
-- version's verified date: a latest-version lookup per assurable deal, ~600 ms), the sparse owner
-- filters (overseas / no residence / exception: 1.1-1.4 s, the count cap never trips) and the
-- dashboard summary (a GROUP BY over the firm).
--
-- Same pattern as V56's ownership_node.real_estate_firm_id: copy the values each list filters and
-- sorts on onto the row being listed, kept current by triggers (no application path can forget
-- them; Hibernate does not map these columns), and index exactly the list's filter + order.
--
-- Every trigger is guarded by WHEN (... IS DISTINCT FROM ...): Hibernate writes every mapped
-- column on each save, so "UPDATE OF col" alone would fire on saves that change nothing.
--
-- Backfill on 500k deals / 1.27M owners takes on the order of a couple of minutes (like V56): run
-- in a maintenance window on a production table of that size, or split the backfill.

-- ===== A. Assurance: the latest version's facts on the deal ===========================

ALTER TABLE deal
    ADD COLUMN IF NOT EXISTS latest_version_id       BIGINT,
    ADD COLUMN IF NOT EXISTS latest_version_no       INTEGER,
    ADD COLUMN IF NOT EXISTS latest_verified_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS latest_assurance_status VARCHAR(16),
    ADD COLUMN IF NOT EXISTS last_closed_at          TIMESTAMPTZ;

UPDATE deal d
   SET latest_version_id = v.id, latest_version_no = v.version_no,
       latest_verified_at = v.verified_at, latest_assurance_status = v.assurance_status
  FROM (SELECT DISTINCT ON (deal_id) deal_id, id, version_no, verified_at, assurance_status
          FROM deal_version ORDER BY deal_id, version_no DESC) v
 WHERE v.deal_id = d.id;

UPDATE deal d
   SET last_closed_at = m.closed_at
  FROM (SELECT deal_id, max(occurred_at) AS closed_at FROM deal_status_move
         WHERE kind = 'CLOSE' GROUP BY deal_id) m
 WHERE m.deal_id = d.id;

-- A new version becomes the deal's latest (versions only ever count up).
CREATE OR REPLACE FUNCTION deal_version_set_latest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deal
     SET latest_version_id = NEW.id, latest_version_no = NEW.version_no,
         latest_verified_at = NEW.verified_at, latest_assurance_status = NEW.assurance_status
   WHERE id = NEW.deal_id
     AND (latest_version_no IS NULL OR NEW.version_no >= latest_version_no);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_deal_version_set_latest
  AFTER INSERT ON deal_version
  FOR EACH ROW EXECUTE FUNCTION deal_version_set_latest();

-- A verdict (or verified date) recorded on the latest version is copied to the deal.
CREATE OR REPLACE FUNCTION deal_version_sync_latest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deal
     SET latest_verified_at = NEW.verified_at, latest_assurance_status = NEW.assurance_status
   WHERE id = NEW.deal_id AND latest_version_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_deal_version_sync_latest
  AFTER UPDATE OF assurance_status, verified_at ON deal_version
  FOR EACH ROW
  WHEN (OLD.assurance_status IS DISTINCT FROM NEW.assurance_status
        OR OLD.verified_at IS DISTINCT FROM NEW.verified_at)
  EXECUTE FUNCTION deal_version_sync_latest();

-- Closing (the transaction-monitoring record every close writes) stamps the deal.
CREATE OR REPLACE FUNCTION deal_status_move_set_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deal
     SET last_closed_at = greatest(coalesce(last_closed_at, NEW.occurred_at), NEW.occurred_at)
   WHERE id = NEW.deal_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_deal_status_move_set_closed
  AFTER INSERT ON deal_status_move
  FOR EACH ROW WHEN (NEW.kind = 'CLOSE')
  EXECUTE FUNCTION deal_status_move_set_closed();

-- The register: assurable deals, most recently verified first, per branch and platform-wide.
CREATE INDEX IF NOT EXISTS idx_deal_assurable_branch
    ON deal (firm_branch_id, latest_verified_at DESC NULLS LAST, id DESC)
    WHERE status IN ('VERIFIED', 'CLOSED');
CREATE INDEX IF NOT EXISTS idx_deal_assurable
    ON deal (latest_verified_at DESC NULLS LAST, id DESC)
    WHERE status IN ('VERIFIED', 'CLOSED');
-- Signed off, not yet reviewed (the "awaiting assurance" count and filter).
CREATE INDEX IF NOT EXISTS idx_deal_assurance_awaiting
    ON deal (firm_branch_id, latest_verified_at DESC NULLS LAST, id DESC)
    WHERE status IN ('VERIFIED', 'CLOSED') AND latest_version_id IS NOT NULL AND latest_assurance_status IS NULL;
-- The close arm of the register's date range.
CREATE INDEX IF NOT EXISTS idx_deal_closed_at
    ON deal (firm_branch_id, last_closed_at)
    WHERE status = 'CLOSED';

-- ===== B. Owner filters: residence on the owner ==========================================

ALTER TABLE ownership_node
    ADD COLUMN IF NOT EXISTS residence_country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS is_overseas       BOOLEAN NOT NULL DEFAULT false;

UPDATE ownership_node n
   SET residence_country = bo.country_of_residence,
       is_overseas = (bo.country_of_residence IS NOT NULL AND bo.country_of_residence <> f.country)
  FROM beneficial_owner bo, real_estate_firm f
 WHERE bo.id = n.beneficial_owner_id AND f.id = n.real_estate_firm_id;

-- V56's node trigger now also derives residence and the overseas flag. It fires on the columns
-- they depend on, including real_estate_firm_id, which V56's deal and branch move triggers
-- rewrite: moving a deal to another firm re-derives the flag against the new firm's country.
CREATE OR REPLACE FUNCTION ownership_node_set_firm() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_firm_country VARCHAR;
BEGIN
  SELECT fb.real_estate_firm_id, f.country INTO NEW.real_estate_firm_id, v_firm_country
    FROM ownership_structure s
    JOIN deal d ON d.id = s.deal_id
    JOIN firm_branch fb ON fb.id = d.firm_branch_id
    JOIN real_estate_firm f ON f.id = fb.real_estate_firm_id
   WHERE s.id = NEW.ownership_structure_id;
  NEW.residence_country := (SELECT bo.country_of_residence FROM beneficial_owner bo
                             WHERE bo.id = NEW.beneficial_owner_id);
  NEW.is_overseas := coalesce(NEW.residence_country IS NOT NULL AND NEW.residence_country <> v_firm_country, false);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ownership_node_set_firm ON ownership_node;
CREATE TRIGGER trg_ownership_node_set_firm
  BEFORE INSERT OR UPDATE OF ownership_structure_id, beneficial_owner_id, real_estate_firm_id ON ownership_node
  FOR EACH ROW EXECUTE FUNCTION ownership_node_set_firm();

-- A person's residence changes: every owner node that stands for them follows.
CREATE OR REPLACE FUNCTION beneficial_owner_sync_residence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ownership_node n
     SET residence_country = NEW.country_of_residence,
         is_overseas = coalesce(NEW.country_of_residence IS NOT NULL AND NEW.country_of_residence <> f.country, false)
    FROM real_estate_firm f
   WHERE n.beneficial_owner_id = NEW.id AND f.id = n.real_estate_firm_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_beneficial_owner_sync_residence
  AFTER UPDATE OF country_of_residence ON beneficial_owner
  FOR EACH ROW WHEN (OLD.country_of_residence IS DISTINCT FROM NEW.country_of_residence)
  EXECUTE FUNCTION beneficial_owner_sync_residence();

-- A firm's country changes: who counts as overseas changes for all its owners.
CREATE OR REPLACE FUNCTION real_estate_firm_sync_overseas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ownership_node
     SET is_overseas = coalesce(residence_country IS NOT NULL AND residence_country <> NEW.country, false)
   WHERE real_estate_firm_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_real_estate_firm_sync_overseas
  AFTER UPDATE OF country ON real_estate_firm
  FOR EACH ROW WHEN (OLD.country IS DISTINCT FROM NEW.country)
  EXECUTE FUNCTION real_estate_firm_sync_overseas();

-- Sparse register filters, newest first per firm. Each holds only the rows in that state.
CREATE INDEX IF NOT EXISTS idx_ownership_node_overseas
    ON ownership_node (real_estate_firm_id, id DESC) WHERE is_overseas;
CREATE INDEX IF NOT EXISTS idx_ownership_node_no_residence
    ON ownership_node (real_estate_firm_id, id DESC) WHERE node_type = 'INDIVIDUAL' AND residence_country IS NULL;
CREATE INDEX IF NOT EXISTS idx_ownership_node_exception
    ON ownership_node (real_estate_firm_id, id DESC) WHERE verification_status = 'VERIFIED_WITH_EXCEPTION';

-- ===== C. Dashboard summary: per-branch, per-status counters ===============================

CREATE TABLE IF NOT EXISTS deal_status_summary (
    firm_branch_id BIGINT      NOT NULL REFERENCES firm_branch (id) ON DELETE CASCADE,
    status         VARCHAR(16) NOT NULL,
    deal_count     BIGINT      NOT NULL DEFAULT 0,
    value_sum      NUMERIC     NOT NULL DEFAULT 0,
    PRIMARY KEY (firm_branch_id, status)
);

INSERT INTO deal_status_summary (firm_branch_id, status, deal_count, value_sum)
SELECT firm_branch_id, status, count(*), coalesce(sum(coalesce(valuation_max, transaction_value)), 0)
  FROM deal GROUP BY firm_branch_id, status
ON CONFLICT (firm_branch_id, status) DO UPDATE
   SET deal_count = EXCLUDED.deal_count, value_sum = EXCLUDED.value_sum;

-- Subtract the old row, add the new one. A row-level upsert on (branch, status): concurrent deal
-- writes in the same branch and status serialise on that one counter row, which is fine at the
-- write rates this application sees (single-digit deal writes per second).
CREATE OR REPLACE FUNCTION deal_maintain_summary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE deal_status_summary
       SET deal_count = deal_count - 1,
           value_sum = value_sum - coalesce(OLD.valuation_max, OLD.transaction_value, 0)
     WHERE firm_branch_id = OLD.firm_branch_id AND status = OLD.status;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO deal_status_summary (firm_branch_id, status, deal_count, value_sum)
    VALUES (NEW.firm_branch_id, NEW.status, 1, coalesce(NEW.valuation_max, NEW.transaction_value, 0))
    ON CONFLICT (firm_branch_id, status) DO UPDATE
       SET deal_count = deal_status_summary.deal_count + 1,
           value_sum = deal_status_summary.value_sum + EXCLUDED.value_sum;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_deal_summary_insert_delete
  AFTER INSERT OR DELETE ON deal
  FOR EACH ROW EXECUTE FUNCTION deal_maintain_summary();

CREATE TRIGGER trg_deal_summary_update
  AFTER UPDATE OF status, firm_branch_id, valuation_max, transaction_value ON deal
  FOR EACH ROW
  WHEN ((OLD.status, OLD.firm_branch_id, OLD.valuation_max, OLD.transaction_value)
        IS DISTINCT FROM (NEW.status, NEW.firm_branch_id, NEW.valuation_max, NEW.transaction_value))
  EXECUTE FUNCTION deal_maintain_summary();

-- Oldest deal per status (a min per branch off the index) and deals changed in the last 30 days
-- (a range bounded by recent activity, not by the size of the firm).
CREATE INDEX IF NOT EXISTS idx_deal_branch_status_created ON deal (firm_branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_deal_branch_status_updated ON deal (firm_branch_id, status, updated_at);
