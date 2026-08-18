package nz.amldock.document;

public enum DocumentType {
    DRIVER_LICENCE,
    PASSPORT,
    TRUST_DEED,
    COMPANY_CERT,
    TITLE_DOC,
    SALE_AGREEMENT,
    /** Voice/audio note attached to a deal or node (typically audio/webm from the browser recorder). */
    VOICE_NOTE,
    /**
     * The deal form's section 2 "transaction purpose" recording. Distinct from VOICE_NOTE so
     * the two clips a deal now carries stay tellable apart on the read side.
     */
    VOICE_NOTE_PURPOSE,
    /** Image evidencing the broker's minimum property valuation (CMA, appraisal, RV screenshot). */
    VALUATION_MIN_EVIDENCE,
    /** Image evidencing the broker's maximum property valuation. */
    VALUATION_MAX_EVIDENCE,
    OTHER;

    /** Document types that get OCR processing (M5+). */
    public boolean isOcrEligible() {
        return this == DRIVER_LICENCE || this == PASSPORT;
    }

    /** Convenience for the frontend's audio player path. */
    public boolean isAudio() {
        return this == VOICE_NOTE || this == VOICE_NOTE_PURPOSE;
    }
}
