package nz.amldock.document;

public enum DocumentType {
    DRIVER_LICENCE,
    PASSPORT,
    TRUST_DEED,
    COMPANY_CERT,
    TITLE_DOC,
    SALE_AGREEMENT,
    OTHER;

    /** Document types that get OCR processing (M5+). */
    public boolean isOcrEligible() {
        return this == DRIVER_LICENCE || this == PASSPORT;
    }
}
