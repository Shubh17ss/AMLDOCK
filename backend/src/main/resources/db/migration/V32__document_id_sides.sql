-- V32: an identity document is front + optional back, and counts as one person.
--
-- V31 made every uploaded image its own beneficial_owner, so scanning both sides of a driver
-- licence produced two people. This groups the sides.
--
-- The owner *is* the grouping key. A separate identity_document table would restate what
-- beneficial_owner already says — "the person this card belongs to" — and force every read to
-- join through it.

ALTER TABLE document
    ADD COLUMN beneficial_owner_id BIGINT,
    -- Null for everything that is not an identity scan: voice notes, valuation evidence,
    -- trust deeds. Only DRIVER_LICENCE and PASSPORT carry a side.
    ADD COLUMN id_side VARCHAR(8),
    -- SET NULL rather than CASCADE: removing a person should never silently destroy the
    -- evidence they were identified from.
    ADD CONSTRAINT fk_document_owner FOREIGN KEY (beneficial_owner_id)
        REFERENCES beneficial_owner(id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_document_id_side CHECK (id_side IS NULL OR id_side IN ('FRONT','BACK'));

CREATE INDEX idx_document_owner ON document(beneficial_owner_id)
    WHERE beneficial_owner_id IS NOT NULL;

-- At most one front and one back per person.
--
-- The status predicate is what lets a broker fix a mis-scan: a soft-deleted front stops
-- occupying the slot, so the replacement can be uploaded without the index rejecting it.
CREATE UNIQUE INDEX uq_document_owner_side ON document(beneficial_owner_id, id_side)
    WHERE beneficial_owner_id IS NOT NULL AND id_side IS NOT NULL AND status <> 'DELETED';

-- Every owner that exists today was created from exactly one document, and the join table
-- records which. Cheap, and correct on any environment that already carries data.
UPDATE document d
   SET beneficial_owner_id = l.beneficial_owner_id,
       id_side             = 'FRONT'
  FROM deal_beneficial_owner l
 WHERE l.source_document_id = d.id;

-- V31 added this purely to serve the name + date-of-birth lookup behind the within-deal dedupe.
-- Documents are never matched against each other now — a different document is a different
-- person, whatever the names say — so nothing queries it. An index no query uses costs write
-- time and, worse, reads as evidence that matching still happens somewhere.
DROP INDEX IF EXISTS idx_beneficial_owner_identity;
