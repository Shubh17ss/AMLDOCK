-- V31: the people on the scanned IDs become records.
--
-- Extraction (V30) reads a name, date of birth and expiry off each scan. This migration gives
-- those people somewhere to live and a place in the deal's ownership graph.
--
-- Two tables rather than one, because they answer different questions with different lifetimes:
--   beneficial_owner  — WHO someone is. Firm-scoped, reusable across deals.
--   ownership_node    — WHERE they sit in one deal's ownership structure.
-- Collapsing them would tie a person's identity to a single deal's graph, which is exactly the
-- constraint the upcoming ownership rework has to remove.

/* ---------- NATURAL_PERSON -> INDIVIDUAL ---------- */

-- The CHECK must go before the rows change, or the UPDATE trips the constraint it is trying to
-- move past. Re-added afterwards against the new vocabulary.
ALTER TABLE ownership_node DROP CONSTRAINT chk_ownership_node_type;

UPDATE ownership_node SET node_type = 'INDIVIDUAL' WHERE node_type = 'NATURAL_PERSON';

ALTER TABLE ownership_node
    ADD CONSTRAINT chk_ownership_node_type CHECK (node_type IN
        ('INDIVIDUAL','NZ_COMPANY','TRUST','PARTNERSHIP','OTHER'));

/* ---------- beneficial_owner ---------- */

CREATE TABLE beneficial_owner (
    id                    BIGSERIAL PRIMARY KEY,

    -- Firm-scoped, not global: one reporting entity must never see another's people, and an
    -- accidental match across tenants would be a privacy breach rather than a convenience.
    real_estate_firm_id   BIGINT NOT NULL,

    -- All three nullable. Textract resolves what it can read; a glare band over the date of
    -- birth yields NULL, and NULL is honest. A placeholder would be indistinguishable from a
    -- real value once it is three screens away from the scan it came from.
    full_name             VARCHAR(255),
    date_of_birth         DATE,
    id_expiry_date        DATE,

    -- Per-field confidence as extracted, e.g.
    -- {"fullName":0.94,"dateOfBirth":1.000,"expiryDate":null}. A null means the field was not
    -- resolved at all. JSONB rather than three numeric columns so the shape can follow the
    -- extractors without a migration each time one learns a new field.
    extraction_confidence JSONB,

    -- Every value here is a machine reading until a human agrees with it. An AML record that
    -- cannot tell those apart is one you cannot defend in an audit. Nothing consumes this yet.
    review_status         VARCHAR(32) NOT NULL DEFAULT 'UNREVIEWED',

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_beneficial_owner_firm FOREIGN KEY (real_estate_firm_id)
        REFERENCES real_estate_firm(id) ON DELETE CASCADE,
    CONSTRAINT chk_beneficial_owner_review CHECK (review_status IN
        ('UNREVIEWED','CONFIRMED','REJECTED'))
);

CREATE INDEX idx_beneficial_owner_firm ON beneficial_owner(real_estate_firm_id);

-- Supports the within-deal duplicate check without a sequential scan as the table grows.
CREATE INDEX idx_beneficial_owner_identity
    ON beneficial_owner(real_estate_firm_id, lower(full_name), date_of_birth)
    WHERE full_name IS NOT NULL AND date_of_birth IS NOT NULL;

/* ---------- deal <-> beneficial_owner ---------- */

-- The "one person, many deals" relation. A join table rather than an array of deal ids on
-- beneficial_owner: an array cannot carry a foreign key, so nothing would stop it holding ids
-- of deals that no longer exist.
CREATE TABLE deal_beneficial_owner (
    deal_id             BIGINT NOT NULL,
    beneficial_owner_id BIGINT NOT NULL,
    -- The scan this person entered this deal through. Nullable so deleting a document does not
    -- take the person with it.
    source_document_id  BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (deal_id, beneficial_owner_id),
    CONSTRAINT fk_dbo_deal   FOREIGN KEY (deal_id)
        REFERENCES deal(id) ON DELETE CASCADE,
    CONSTRAINT fk_dbo_owner  FOREIGN KEY (beneficial_owner_id)
        REFERENCES beneficial_owner(id) ON DELETE CASCADE,
    CONSTRAINT fk_dbo_source FOREIGN KEY (source_document_id)
        REFERENCES document(id) ON DELETE SET NULL
);

-- The PK covers deal -> owners; this covers the other direction, which is what "every deal this
-- person appears on" needs.
CREATE INDEX idx_dbo_owner ON deal_beneficial_owner(beneficial_owner_id);

/* ---------- ownership_node -> beneficial_owner ---------- */

-- ON DELETE SET NULL, not CASCADE: removing a person record should not silently delete a node
-- someone may have already wired into an ownership structure.
ALTER TABLE ownership_node
    ADD COLUMN beneficial_owner_id BIGINT,
    ADD CONSTRAINT fk_ownership_node_owner FOREIGN KEY (beneficial_owner_id)
        REFERENCES beneficial_owner(id) ON DELETE SET NULL;

CREATE INDEX idx_ownership_node_owner ON ownership_node(beneficial_owner_id)
    WHERE beneficial_owner_id IS NOT NULL;
