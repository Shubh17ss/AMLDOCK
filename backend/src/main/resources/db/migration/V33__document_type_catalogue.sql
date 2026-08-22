-- V33: the full document catalogue a CDD file actually needs.
--
-- Until now a deal could carry a driver licence, a passport and a handful of property documents.
-- Real customer due diligence files hold far more: proof of address, source of funds, citizenship
-- and birth certificates, verification results, powers of attorney. This adds them.
--
-- Passports and licences also become country-specific. "Passport" alone cannot say whether the
-- holder is domestic or foreign, which is a risk-relevant fact rather than a labelling nicety.

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
        -- picker, but still accepted so rows written before this migration keep reading.
        --
        -- Deliberately not rewritten to a country-specific value: the old values carry no
        -- country, and inventing one on an identity record is worse than an honestly vague
        -- historical value.
        'DRIVER_LICENCE',
        'PASSPORT'
    ));

-- V6 pinned ownership_node.id_document_type to the same two values. BeneficialOwnerService
-- writes the document's type into that column when it creates an individual, so leaving this
-- in place would make every upload of a newly-added ID type fail on the constraint.
--
-- Dropped rather than widened. The column is documented in OwnershipNode as "kept as string for
-- flex", and a second enumeration of the catalogue would need editing in lockstep with the one
-- above forever — two lists that must agree, with nothing enforcing that they do.
ALTER TABLE ownership_node DROP CONSTRAINT chk_ownership_node_id_doc_type;
