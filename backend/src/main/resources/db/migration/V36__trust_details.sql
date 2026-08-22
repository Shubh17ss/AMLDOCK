-- V36: what a trust has to answer.
--
-- Third risk-bearing answer in the ownership structure, after the private company's nominee and
-- complex-ownership questions (V35): a trust holding an extensive or diverse asset portfolio
-- sets the deal to HIGH. The rule stays in DealRiskService; this only gives it another input.

ALTER TABLE ownership_node
    ADD COLUMN trust_type                VARCHAR(48),
    ADD COLUMN trust_discretionary       BOOLEAN,
    -- EXTENSIVE_DIVERSE_PORTFOLIO raises the deal to HIGH. Three named bands rather than a
    -- property count: the distinction that matters is between a trust holding one house and a
    -- trust operating as an investment vehicle, and a count cannot express the second.
    ADD COLUMN trust_holding_complexity  VARCHAR(48),
    ADD CONSTRAINT chk_ownership_node_trust_type
        CHECK (trust_type IS NULL OR trust_type IN (
            'FAMILY',
            'CHARITABLE',
            'INVESTMENT',
            'TESTAMENTARY',
            'ASSET_PROTECTION',
            'SUPERANNUATION',
            'INHERITANCE_DEFINED_INTEREST'
        )),
    ADD CONSTRAINT chk_ownership_node_trust_holding
        CHECK (trust_holding_complexity IS NULL OR trust_holding_complexity IN (
            'SINGLE_PROPERTY_ASSET',
            'MORE_THAN_ONE_PROPERTY_ASSET',
            'EXTENSIVE_DIVERSE_PORTFOLIO'
        ));

-- Nullable throughout, matching V35: a node nobody has opened must not read as answers somebody
-- gave, and the risk rule treats an unanswered complexity question as no risk.

/* ---------- document types the trust's accepted list needs ---------- */

-- The other seven (trust deed, bank statement, source of funds/wealth, financial statements,
-- registry search result, web search result, other) already exist from V33 and V35.
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

        -- Trust evidence (V36)
        'AMENDMENTS_OR_VARIATIONS',
        'TRUSTEES_RESOLUTION',

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
