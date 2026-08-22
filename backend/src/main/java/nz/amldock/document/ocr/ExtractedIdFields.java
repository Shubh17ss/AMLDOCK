package nz.amldock.document.ocr;

import java.time.LocalDate;

/**
 * What we read off one identity document.
 *
 * <p>Three fields by deliberate scope: full name, date of birth, expiry. The document number is
 * read by the MRZ path (it feeds the composite check digit) but never retained.
 *
 * <p>Any field the extractor could not determine is {@link ExtractedField#empty()} — never a
 * guess and never a placeholder. A wrong date of birth on an AML record is worse than a missing
 * one, because the missing one is visibly missing.
 */
public record ExtractedIdFields(
        ExtractedField<String> fullName,
        ExtractedField<LocalDate> dateOfBirth,
        ExtractedField<LocalDate> expiryDate,
        String rawText) {

    public static ExtractedIdFields empty(String rawText) {
        return new ExtractedIdFields(
                ExtractedField.empty(), ExtractedField.empty(), ExtractedField.empty(), rawText);
    }

    /** True when nothing at all could be read — the caller may want to try another strategy. */
    public boolean isEmpty() {
        return !fullName.isPresent() && !dateOfBirth.isPresent() && !expiryDate.isPresent();
    }
}
