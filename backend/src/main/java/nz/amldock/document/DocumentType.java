package nz.amldock.document;

/**
 * Everything that can be attached to a deal.
 *
 * <p>Each type declares how it is read, which is the only thing the code branches on. That
 * classification decides three separate behaviours at once, so it is worth stating deliberately
 * rather than scattering {@code == PASSPORT} checks around:
 *
 * <ul>
 *   <li>whether confirming an upload creates a {@code beneficial_owner} (an individual);</li>
 *   <li>whether the document is queued for Textract at all;</li>
 *   <li>which extractor reads it.</li>
 * </ul>
 *
 * <p><strong>Keep in sync with</strong> {@code chk_document_type} (last rebuilt by V33) and
 * {@code frontend/src/api/documents.js}, which carries the display labels.
 */
public enum DocumentType {

    /* ---------- ICAO 9303 travel documents: the machine-readable zone carries the fields ---------- */

    NZ_PASSPORT(Extraction.MRZ),
    AU_PASSPORT(Extraction.MRZ),
    OVERSEAS_PASSPORT(Extraction.MRZ),
    /** Issued under the 1951 Refugee Convention, and MRZ-bearing like any passport. */
    REFUGEE_TRAVEL_DOCUMENT(Extraction.MRZ),

    /* ---------- card-shaped IDs: fields are printed, so they are read by query ---------- */

    NZ_DRIVER_LICENCE(Extraction.QUERIES),
    AU_DRIVER_LICENCE(Extraction.QUERIES),
    INTERNATIONAL_DRIVING_PERMIT(Extraction.QUERIES),
    /**
     * Many national ID cards do carry an MRZ, but in the TD1 (3x30) or TD2 (2x36) layouts.
     * {@code MrzParser} implements TD3 only, so these go down the query path rather than
     * failing an MRZ parse and falling back at the cost of a second Textract call.
     */
    NATIONAL_IDENTITY_CARD(Extraction.QUERIES),
    FOREIGN_IDENTITY_CARD(Extraction.QUERIES),
    /** NZ evidence-of-age card. Carries name, date of birth and an expiry. */
    KIWI_ACCESS_CARD(Extraction.QUERIES),

    /* ---------- supporting evidence: filed against the deal, never extracted ---------- */

    PROOF_OF_ADDRESS(Extraction.NONE),
    BANK_CARD(Extraction.NONE),
    BANK_STATEMENT(Extraction.NONE),
    CERTIFICATE_OF_CITIZENSHIP(Extraction.NONE),
    FOREIGN_CITIZENSHIP_CERTIFICATE(Extraction.NONE),
    BIRTH_CERTIFICATE(Extraction.NONE),
    MARRIAGE_CERTIFICATE(Extraction.NONE),
    DEATH_CERTIFICATE(Extraction.NONE),
    GOVERNMENT_CARD(Extraction.NONE),
    GOVERNMENT_STATEMENT(Extraction.NONE),
    SOURCE_OF_FUNDS_WEALTH(Extraction.NONE),
    TAX_RETURN(Extraction.NONE),
    WAGE_SLIP(Extraction.NONE),
    ELECTRONIC_ID_VERIFICATION_RESULT(Extraction.NONE),
    BIOMETRIC_VERIFICATION_RESULT(Extraction.NONE),
    ENDURING_POWER_OF_ATTORNEY(Extraction.NONE),
    CERTIFICATE_OF_NON_REVOCATION(Extraction.NONE),
    WEB_SEARCH_RESULT(Extraction.NONE),
    LETTER_FROM_TRUSTED_REFEREE(Extraction.NONE),

    /* ---------- pre-existing types, still in use ---------- */

    TRUST_DEED(Extraction.NONE),
    COMPANY_CERT(Extraction.NONE),
    TITLE_DOC(Extraction.NONE),
    SALE_AGREEMENT(Extraction.NONE),
    /** Voice/audio note attached to a deal or node (typically audio/webm from the browser recorder). */
    VOICE_NOTE(Extraction.NONE),
    /**
     * The deal form's section 2 "transaction purpose" recording. Distinct from VOICE_NOTE so
     * the two clips a deal now carries stay tellable apart on the read side.
     */
    VOICE_NOTE_PURPOSE(Extraction.NONE),
    /** Image evidencing the broker's minimum property valuation (CMA, appraisal, RV screenshot). */
    VALUATION_MIN_EVIDENCE(Extraction.NONE),
    /** Image evidencing the broker's maximum property valuation. */
    VALUATION_MAX_EVIDENCE(Extraction.NONE),
    OTHER(Extraction.NONE),

    /* ---------- legacy ---------- */

    /**
     * Superseded by the country-specific types above and removed from the upload picker, but
     * kept valid so rows recorded before V33 still read.
     *
     * <p>Not migrated to a country-specific value: these carry no country, and inventing one on
     * an identity record is a worse outcome than an honestly vague historical value.
     */
    @Deprecated DRIVER_LICENCE(Extraction.QUERIES),
    @Deprecated PASSPORT(Extraction.MRZ);

    /** How a document's fields are read, if at all. */
    public enum Extraction {
        /** ICAO 9303 machine-readable zone — fixed offsets with check digits. */
        MRZ,
        /** Textract AnalyzeDocument QUERIES against printed labels. */
        QUERIES,
        /** Not an identity document. Stored as evidence; never sent to Textract. */
        NONE
    }

    private final Extraction extraction;

    DocumentType(Extraction extraction) {
        this.extraction = extraction;
    }

    public Extraction extraction() {
        return extraction;
    }

    /**
     * Whether this document identifies a person, and so gets an individual and an extraction.
     *
     * <p>Deliberately narrow. A bank statement or a marriage certificate names people too, but
     * uploading one must not conjure a new individual onto the deal — supporting evidence is
     * filed against a person who is already there.
     */
    public boolean isOcrEligible() {
        return extraction != Extraction.NONE;
    }

    /** Convenience for the frontend's audio player path. */
    public boolean isAudio() {
        return this == VOICE_NOTE || this == VOICE_NOTE_PURPOSE;
    }
}
