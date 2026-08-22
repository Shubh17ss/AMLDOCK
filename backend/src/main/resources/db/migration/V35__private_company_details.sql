-- V35: what a private company has to answer, and the first node field that moves a deal's risk.
--
-- Two of these questions — nominee director/shareholder, and complex ownership structure — set
-- the deal's rating to HIGH. Until now the rating was derived from deal columns alone, so this
-- is the first time the ownership structure has had a say in it. The rule itself lives in
-- DealRiskService; this migration only gives it something to read.

/* ---------- private company details ---------- */

ALTER TABLE ownership_node
    ADD COLUMN company_has_constitution   BOOLEAN,
    -- Tri-state, unlike the four below: "not asked" is the honest starting state for a question
    -- whose YES carries a risk consequence, and it is the answer the user asked to default to.
    ADD COLUMN company_nominee            VARCHAR(16),
    ADD COLUMN company_complex_ownership  BOOLEAN,
    ADD COLUMN company_personal_assets    BOOLEAN,
    ADD COLUMN company_new_developer      BOOLEAN,
    -- ISO 3166-1 alpha-2, matching beneficial_owner.phone_country (V34). Decides whether the
    -- business number field is labelled NZBN, ABN or Registration number.
    ADD COLUMN country_of_incorporation   VARCHAR(2),
    ADD CONSTRAINT chk_ownership_node_company_nominee
        CHECK (company_nominee IS NULL OR company_nominee IN ('NOT_ASKED', 'YES', 'NO'));

-- Nullable rather than NOT NULL DEFAULT FALSE. The form starts the four plain questions at "No",
-- but a row nobody has opened must not read as four negative answers somebody gave. The risk
-- rule treats NULL as "no", so the behaviour on screen is unchanged either way.

/* ---------- nzbn -> business_number ---------- */

-- The column holds an NZBN, an ABN or a foreign registration number depending on the country of
-- incorporation. Named `nzbn` it would be a misleading record rather than an untidy one — an
-- Australian company's ABN filed under a New Zealand identifier.
--
-- Distinct from real_estate_firm.nzbn, which is untouched: that one identifies the reporting
-- entity itself and is NZ/AU only.
ALTER TABLE ownership_node RENAME COLUMN nzbn TO business_number;

/* ---------- document types the accepted-list needs ---------- */

-- The other seven types on the private company list (bank statement, source of funds/wealth,
-- web search result, tax return, proof of address, certificate of incorporation, other) already
-- exist from V33.
ALTER TABLE document DROP CONSTRAINT chk_document_type;

ALTER TABLE document
    ADD CONSTRAINT chk_document_type CHECK (document_type IN (
        -- ICAO 9303 travel documents (MRZ-readable)
        'NZ_PASSPORT',
        'AU_PASSPORT',
        'OVERSEAS_PASSPORT',
        'REFUGEE_TRAVEL_DOCUMENT',

        -- Card-shaped IDs (read by Textract queries)
        'NZ_DRIVER_LICENCE',
        'AU_DRIVER_LICENCE',
        'INTERNATIONAL_DRIVING_PERMIT',
        'NATIONAL_IDENTITY_CARD',
        'FOREIGN_IDENTITY_CARD',
        'KIWI_ACCESS_CARD',

        -- Supporting evidence, never extracted
        'PROOF_OF_ADDRESS',
        'BANK_CARD',
        'BANK_STATEMENT',
        'CERTIFICATE_OF_CITIZENSHIP',
        'FOREIGN_CITIZENSHIP_CERTIFICATE',
        'BIRTH_CERTIFICATE',
        'MARRIAGE_CERTIFICATE',
        'DEATH_CERTIFICATE',
        'GOVERNMENT_CARD',
        'GOVERNMENT_STATEMENT',
        'SOURCE_OF_FUNDS_WEALTH',
        'TAX_RETURN',
        'WAGE_SLIP',
        'ELECTRONIC_ID_VERIFICATION_RESULT',
        'BIOMETRIC_VERIFICATION_RESULT',
        'ENDURING_POWER_OF_ATTORNEY',
        'CERTIFICATE_OF_NON_REVOCATION',
        'WEB_SEARCH_RESULT',
        'LETTER_FROM_TRUSTED_REFEREE',

        -- Entity evidence (V35)
        'COMPANY_EXTRACT',
        'OWNERSHIP_STRUCTURE',
        'COMPANY_CONSTITUTION',
        'FINANCIAL_STATEMENTS',
        'REGISTRY_SEARCH_RESULT',

        -- Pre-existing
        'TRUST_DEED',
        'COMPANY_CERT',
        'TITLE_DOC',
        'SALE_AGREEMENT',
        'VOICE_NOTE',
        'VOICE_NOTE_PURPOSE',
        'VALUATION_MIN_EVIDENCE',
        'VALUATION_MAX_EVIDENCE',
        'OTHER',

        -- Legacy. Superseded by the country-specific values above and gone from the upload
        -- picker, but still accepted so rows written before V33 keep reading.
        'DRIVER_LICENCE',
        'PASSPORT'
    ));
