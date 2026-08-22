-- V37: the eight remaining entity types.
--
-- Trustee company, limited partnership, partnership, listed company, incorporated society,
-- charity, government agency, deceased estate. Between them they ask for three facts the schema
-- does not already hold, and two columns that turn out to have been named too narrowly.

/* ---------- the nominee question is not only a company question ---------- */

-- A limited partnership asks the same question about a nominee limited partner that a private
-- company asks about a nominee director or shareholder: is an intermediary standing in for the
-- real party? Same three states, same consequence — YES sets the deal to HIGH.
--
-- Renamed rather than duplicated. A second column would need a second clause in DealRiskService,
-- and two clauses that must stay identical are two clauses that will not.
ALTER TABLE ownership_node RENAME COLUMN company_nominee TO nominee_status;
ALTER TABLE ownership_node RENAME CONSTRAINT chk_ownership_node_company_nominee
    TO chk_ownership_node_nominee;

/* ---------- country of incorporation is not only about incorporation ---------- */

-- Eight types now want this field and they call it two things. A private company, listed company
-- and limited partnership are incorporated somewhere; a deceased estate is not incorporated at
-- all, and asking for its "country of incorporation" is a question with no answer.
--
-- One column, labelled per type on screen — the same treatment business_number already gets,
-- where the label reads NZBN, ABN or Registration number over one stored value.
ALTER TABLE ownership_node RENAME COLUMN country_of_incorporation TO jurisdiction_country;

/* ---------- what a partnership adds ---------- */

-- Node-level, distinct from beneficial_owner.source_of_funds (V34), which belongs to a person
-- and follows them across deals. A partnership is not a person and has no record to follow.
ALTER TABLE ownership_node ADD COLUMN source_of_funds TEXT;

/* ---------- document types the eight accepted lists need ---------- */

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

        -- Partnership, listed company, society, charity and estate evidence (V37)
        'LIMITED_PARTNERSHIP_EXTRACT',
        'PARTNERSHIP_STRUCTURE',
        'PARTNERSHIP_AGREEMENT',
        'EXCHANGE_REGISTRATION_SEARCH_RESULT',
        'SOCIETY_RULES',
        'CHARITIES_REGISTER_INFORMATION',
        'PROBATE_OR_WILL',

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
