-- Deal-level broker notes + a new VOICE_NOTE document type so audio recordings can flow
-- through the existing S3 + Document pipeline (presigned PUT → confirm).
--
-- The wizard's review step keeps the voice blob in browser state until the broker hits
-- Save Draft / Submit, then uploads it as a regular document attached to the deal.

ALTER TABLE deal
    ADD COLUMN notes TEXT;

-- Extend the document type whitelist. The constraint was created in V5 against a fixed
-- set of values, so we drop and re-add it with VOICE_NOTE included.
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
        'OTHER'
    ));
