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
    OTHER;

    /** Document types that get OCR processing (M5+). */
    public boolean isOcrEligible() {
        return this == DRIVER_LICENCE || this == PASSPORT;
    }

    /** Convenience for the frontend's audio player path. */
    public boolean isAudio() {
        return this == VOICE_NOTE;
    }
}
