-- V41: deal versions — a verified deal can go back to review without losing what was signed off.
--
-- Until now VERIFIED was a one-way door. RULES let a deal out of it only into CLOSED, and
-- REVIEWER_EDITABLE_STATUSES excluded it for everyone, on the stated grounds that "quietly editing
-- the evidence underneath a sign-off would make the sign-off untrue". That reasoning still holds.
-- What changes is the answer to it: instead of unlocking VERIFIED, the deal is *copied* the moment
-- it is verified, and the copy is what the sign-off refers to from then on. The live deal is then
-- free to go back to REVIEW and be corrected, because nothing a reviewer does to it can reach the
-- copy.
--
-- So these tables are not an audit trail. audit_log already records what happened; deal_note
-- already records what was said. These record what the deal *was* — the state a compliance officer
-- had in front of them when they signed it off, reproducible in full years later.
--
--     verify   -> write version n, deal becomes VERIFIED
--     reopen   -> stamp version n with who reopened it and why, deal becomes REVIEW
--     verify   -> write version n+1
--
-- ---------------------------------------------------------------------------------------------
-- Why LIKE rather than a column list
--
-- Every table below mirrors a live table. Spelling ~120 columns out again would create two places
-- for each to be described and one of them would eventually be wrong: the failure mode is a
-- migration that adds a column to ownership_node and forgets its twin, producing snapshots with a
-- silent hole in them that no review would reveal.
--
-- LIKE copies the column names, types and NOT NULLs from the source table as they stand today, so
-- the two cannot disagree at birth. Drift afterwards is caught in Java rather than here: each pair
-- shares a @MappedSuperclass (DealFields, OwnershipNodeFields, ...), so a column added to the live
-- entity is a column the snapshot entity also declares, and ddl-auto: validate then refuses to
-- start until this table has it too. Between them, the two mechanisms make an incomplete snapshot
-- a build failure instead of a discovery.
--
-- EXCLUDING ALL is deliberate and load-bearing. It drops the source's defaults, indexes and
-- constraints, and three of those must not come across:
--
--   * deal.reference UNIQUE (V3)      every version of a deal shares its reference.
--   * document.s3_key UNIQUE (V5)     versions share one S3 object *by design*. The bytes are
--                                     written once and never overwritten (DocumentService
--                                     .buildKey puts a UUID in every key), so a document deleted
--                                     from the live deal later stays readable from the version it
--                                     was signed off with. DocumentService.delete skips
--                                     storage.delete for exactly these rows.
--   * ownership_edge (parent, child)  unique per structure, not across every version of one.
--                                     Re-added below, scoped to the version.
--
-- It also drops each source's BIGSERIAL default, so the mirrored id arrives as a plain column.
-- Each table drops it and declares its own; the original is kept as source_*_id, which is what
-- edges and documents point at (BIGSERIAL never reuses a value, so those ids stay unambiguous
-- inside a version and need no remapping on the way in or out).

/* ---------- 1. the version header ---------- */

CREATE TABLE deal_version (LIKE deal EXCLUDING ALL);
ALTER TABLE deal_version DROP COLUMN id;
ALTER TABLE deal_version
    ADD COLUMN id                  BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_id             BIGINT NOT NULL,
    ADD COLUMN version_no          INT    NOT NULL,

    -- The sign-off itself. It lives here rather than on the deal because the deal does not keep
    -- it: moving to REVIEW clears decided_by_user_id / decided_at (DealLifecycleService
    -- .stampDecision), which is correct — the live deal is no longer verified. The version is
    -- where the sign-off goes on being true.
    ADD COLUMN verified_by_user_id BIGINT NOT NULL,
    ADD COLUMN verified_at         TIMESTAMPTZ NOT NULL,
    ADD COLUMN verify_note         TEXT   NOT NULL,

    -- Filled when this version is reopened, and never again. Completing the record of the
    -- version's life; the mirrored columns above are written once and never touched.
    ADD COLUMN reopened_by_user_id BIGINT,
    ADD COLUMN reopened_at         TIMESTAMPTZ,
    ADD COLUMN reopen_note         TEXT,

    -- ownership_structure is 1-1 with the deal (V6: deal_id NOT NULL UNIQUE), so its two useful
    -- columns fold in here rather than earning a table with one row in it.
    ADD COLUMN root_node_id        BIGINT,
    ADD COLUMN structure_notes     TEXT;

ALTER TABLE deal_version
    ADD CONSTRAINT fk_deal_version_deal     FOREIGN KEY (deal_id)             REFERENCES deal(id)     ON DELETE CASCADE,
    -- RESTRICT, matching fk_deal_note_author: the officer who signed a deal off must not silently
    -- detach from the sign-off when they leave the firm.
    ADD CONSTRAINT fk_deal_version_verifier FOREIGN KEY (verified_by_user_id) REFERENCES app_user(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_deal_version_reopener FOREIGN KEY (reopened_by_user_id) REFERENCES app_user(id) ON DELETE RESTRICT,
    -- Deliberately a constraint and not just a convention. compliance_document (V14) numbers its
    -- versions by reading the max and adding one with nothing behind it, so two concurrent uploads
    -- both write version 3. Here the second one fails instead.
    ADD CONSTRAINT uq_deal_version          UNIQUE (deal_id, version_no),
    ADD CONSTRAINT chk_deal_version_no      CHECK (version_no >= 1),
    -- A reopen names who and when together, or neither. Half a record is worse than none — same
    -- reasoning as chk_deal_note_transition (V29).
    ADD CONSTRAINT chk_deal_version_reopen  CHECK (
        (reopened_by_user_id IS NULL     AND reopened_at IS NULL)
     OR (reopened_by_user_id IS NOT NULL AND reopened_at IS NOT NULL));

CREATE INDEX idx_deal_version_deal ON deal_version(deal_id, version_no DESC);

/* ---------- 2. the copied graph ---------- */

-- property and client are 1-1 with the deal and are deleted with it (DealService.delete), so a
-- version keeps its own copy of each.

CREATE TABLE deal_version_property (LIKE property EXCLUDING ALL);
ALTER TABLE deal_version_property DROP COLUMN id;
ALTER TABLE deal_version_property
    ADD COLUMN id                 BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_version_id    BIGINT NOT NULL,
    ADD COLUMN source_property_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_dvp_version FOREIGN KEY (deal_version_id) REFERENCES deal_version(id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_dvp_version UNIQUE (deal_version_id);

CREATE TABLE deal_version_client (LIKE client EXCLUDING ALL);
ALTER TABLE deal_version_client DROP COLUMN id;
ALTER TABLE deal_version_client
    ADD COLUMN id               BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_version_id  BIGINT NOT NULL,
    ADD COLUMN source_client_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_dvc_version FOREIGN KEY (deal_version_id) REFERENCES deal_version(id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_dvc_version UNIQUE (deal_version_id);

-- The ownership structure. Nodes carry the answers DealRiskService reads, so a version that
-- captured the deal but not these could not reproduce the rating it was signed off with.

CREATE TABLE deal_version_node (LIKE ownership_node EXCLUDING ALL);
ALTER TABLE deal_version_node DROP COLUMN id;
ALTER TABLE deal_version_node
    ADD COLUMN id              BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_version_id BIGINT NOT NULL,
    -- The live node this froze. Edges and documents in this version name it, and it is what
    -- deal_version.root_node_id points at.
    ADD COLUMN source_node_id  BIGINT NOT NULL,
    ADD CONSTRAINT fk_dvn_version FOREIGN KEY (deal_version_id) REFERENCES deal_version(id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_dvn_source  UNIQUE (deal_version_id, source_node_id);

CREATE INDEX idx_dvn_version ON deal_version_node(deal_version_id);

CREATE TABLE deal_version_edge (LIKE ownership_edge EXCLUDING ALL);
ALTER TABLE deal_version_edge DROP COLUMN id;
ALTER TABLE deal_version_edge
    ADD COLUMN id              BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_version_id BIGINT NOT NULL,
    ADD COLUMN source_edge_id  BIGINT NOT NULL,
    ADD CONSTRAINT fk_dve_version FOREIGN KEY (deal_version_id) REFERENCES deal_version(id) ON DELETE CASCADE,
    -- V6's uq_ownership_edge, scoped: one edge between a pair *within a version*, not across all
    -- of them.
    ADD CONSTRAINT uq_dve_pair    UNIQUE (deal_version_id, parent_node_id, child_node_id);

CREATE INDEX idx_dve_version ON deal_version_edge(deal_version_id);

-- Document metadata. The bytes are not copied — see the header.

CREATE TABLE deal_version_document (LIKE document EXCLUDING ALL);
ALTER TABLE deal_version_document DROP COLUMN id;
ALTER TABLE deal_version_document
    ADD COLUMN id                 BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_version_id    BIGINT NOT NULL,
    -- Not an FK. The live row may be deleted later; the version's record of it must not be taken
    -- with it, which is the whole point.
    ADD COLUMN source_document_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_dvd_version FOREIGN KEY (deal_version_id) REFERENCES deal_version(id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_dvd_source  UNIQUE (deal_version_id, source_document_id);

CREATE INDEX idx_dvd_version ON deal_version_document(deal_version_id);
-- What DocumentService.delete asks before removing an object from S3: is any version still
-- pointing at this document?
CREATE INDEX idx_dvd_source   ON deal_version_document(source_document_id);

-- The people. beneficial_owner is scoped to the *firm* and shared across its deals ("shared with
-- every other deal this person appears on"), so work on an unrelated deal can edit the row a
-- verified deal was checked against. Copied, therefore, rather than referenced.

CREATE TABLE deal_version_person (LIKE beneficial_owner EXCLUDING ALL);
ALTER TABLE deal_version_person DROP COLUMN id;
ALTER TABLE deal_version_person
    ADD COLUMN id                         BIGSERIAL PRIMARY KEY,
    ADD COLUMN deal_version_id            BIGINT NOT NULL,
    ADD COLUMN source_beneficial_owner_id BIGINT NOT NULL,
    -- From deal_beneficial_owner (V31): which document put this person on the deal.
    ADD COLUMN source_document_id         BIGINT,
    ADD CONSTRAINT fk_dvper_version FOREIGN KEY (deal_version_id) REFERENCES deal_version(id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_dvper_source  UNIQUE (deal_version_id, source_beneficial_owner_id);

CREATE INDEX idx_dvper_version ON deal_version_person(deal_version_id);

-- deal_note is deliberately not copied. It is already append-only and never edited or deleted
-- (V29: "a compliance thread that can be rewritten afterwards is worth less than no thread at
-- all"), so a version's thread is the existing table read up to verified_at. A second copy of
-- rows that cannot change would only be one more thing to keep honest.
