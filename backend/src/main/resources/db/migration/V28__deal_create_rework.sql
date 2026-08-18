-- V28: broker deal-creation rework.
--
-- The old wizard captured what a transaction was but never why, and produced no risk
-- position. This adds the compliance question set the broker actually holds at listing time:
-- property classification, reason for selling, trust involvement, on-sold-quickly, foreign
-- exposure, red flag, a valuation range, and a derived risk rating.
--
-- Column placement: attributes of the asset go on `property`; the broker's transaction-time
-- assessments and compliance answers go on `deal`.
--
-- Every new column is nullable so pre-V28 deals keep reading. The UI renders those as
-- "Not assessed" rather than inventing a value for them.

/* ---------- property ---------- */

-- Neither taxonomy column carries a CHECK, following the V20 red_flag precedent, so option
-- lists can grow in code without a migration. reason_for_selling's valid set is conditional
-- on property_type and is owned by frontend/src/data/propertyTypes.js — a flat CHECK (or a
-- flat Java enum) could not express that dependency and so would validate nothing useful.
ALTER TABLE property
    ADD COLUMN property_type      VARCHAR(32),
    ADD COLUMN reason_for_selling VARCHAR(64);

/* ---------- client ---------- */

-- The client is provisional at creation. The broker scans IDs of natural persons, but the
-- entity that actually owns the property (company / LLP / trust / individual) is determined
-- by admin/AMLCo during the ownership-structure review that follows this work. display_name
-- is seeded from the deal's key contact so lists stay readable; client_type stays NULL and
-- renders as "Pending review" until that review sets it.
--
-- chk_client_type is left alone deliberately: a CHECK passes on NULL, so it still constrains
-- every non-null value without blocking the pending state.
ALTER TABLE client
    ALTER COLUMN display_name DROP NOT NULL,
    ALTER COLUMN client_type  DROP NOT NULL;

/* ---------- deal ---------- */

ALTER TABLE deal
    ADD COLUMN transaction_purpose      TEXT,
    ADD COLUMN trust_involved           BOOLEAN,
    ADD COLUMN on_sold_quickly          BOOLEAN,
    -- ISO 3166-1 alpha-2, or the literal 'NONE' meaning "asked, and there is none".
    -- NULL means "not answered yet" — a different compliance fact from "no exposure", and
    -- one worth keeping distinct in an audit trail.
    --
    -- NULL-as-none would also be unreachable through the API: DealService.update only writes
    -- non-null fields, so a PATCH could never clear a previously chosen country back out.
    -- Hence a real sentinel value, and hence VARCHAR(4) rather than the VARCHAR(2) used by
    -- international_fund_transaction.overseas_jurisdiction.
    ADD COLUMN foreign_exposure_country VARCHAR(4),
    ADD COLUMN red_flag_present         BOOLEAN,
    ADD COLUMN valuation_min            NUMERIC(15,2),
    ADD COLUMN valuation_max            NUMERIC(15,2),
    -- Derived server-side from on_sold_quickly — see DealService.applyRiskRating. Never
    -- accepted from the client: a risk rating that disagrees with its own inputs would be an
    -- unfalsifiable AML record.
    ADD COLUMN risk_rating              VARCHAR(16),
    -- DERIVED: recomputed on every write. OVERRIDE: pinned by compliance, and the derivation
    -- leaves it alone. No override endpoint ships with this change; the column exists so
    -- adding one later needs neither a migration nor a change to the read contract.
    ADD COLUMN risk_rating_source       VARCHAR(16) NOT NULL DEFAULT 'DERIVED';

ALTER TABLE deal
    ADD CONSTRAINT chk_deal_risk_rating CHECK (
        risk_rating IS NULL OR risk_rating IN ('LOW','MEDIUM','HIGH')),
    ADD CONSTRAINT chk_deal_risk_source CHECK (
        risk_rating_source IN ('DERIVED','OVERRIDE')),
    ADD CONSTRAINT chk_deal_foreign_exposure CHECK (
        foreign_exposure_country IS NULL
        OR foreign_exposure_country = 'NONE'
        OR foreign_exposure_country ~ '^[A-Z]{2}$'),
    ADD CONSTRAINT chk_deal_valuation_min   CHECK (valuation_min IS NULL OR valuation_min >= 0),
    ADD CONSTRAINT chk_deal_valuation_max   CHECK (valuation_max IS NULL OR valuation_max >= 0),
    -- Backstop only. DealService validates the range first and throws BadRequestException so
    -- the broker gets a 400 with a message instead of a constraint violation surfacing as a
    -- 500. Both bounds always travel in the same PATCH, so there is no window in which a
    -- half-applied update trips this.
    ADD CONSTRAINT chk_deal_valuation_range CHECK (
        valuation_min IS NULL OR valuation_max IS NULL OR valuation_max >= valuation_min);

/* ---------- document types ---------- */

-- Section 4 uploads two valuation-evidence images, and there are now two voice notes per deal
-- (the section 2 transaction purpose and the section 4 deal notes). All four must be
-- distinguishable when read back.
--
-- document_type + deal_id already expresses this, so no link table and no separate `role`
-- column: document_type is the discriminator every read surface already filters on, and a
-- second parallel discriminator would mean teaching every consumer about both. V10 set this
-- precedent when it added VOICE_NOTE.
--
-- The constraint was created in V5 against a fixed set, so drop and re-add — same shape as V10.
ALTER TABLE document
    DROP CONSTRAINT chk_document_type;

ALTER TABLE document
    ADD CONSTRAINT chk_document_type CHECK (document_type IN (
        'DRIVER_LICENCE',
        'PASSPORT',
        'TRUST_DEED',
        'COMPANY_CERT',
        'TITLE_DOC',
        'SALE_AGREEMENT',
        'VOICE_NOTE',
        'VOICE_NOTE_PURPOSE',
        'VALUATION_MIN_EVIDENCE',
        'VALUATION_MAX_EVIDENCE',
        'OTHER'
    ));
