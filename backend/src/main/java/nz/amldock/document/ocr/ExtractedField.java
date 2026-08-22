package nz.amldock.document.ocr;

import java.math.BigDecimal;

/**
 * One extracted value and how sure we are of it.
 *
 * <p>Per-field rather than per-document because a scan is rarely uniformly legible — a glare
 * band across the expiry date says nothing about the name printed above it.
 *
 * @param value      the value, or null if it could not be determined
 * @param confidence 0..1. Null when the value is null.
 */
public record ExtractedField<T>(T value, BigDecimal confidence) {

    private static final ExtractedField<?> EMPTY = new ExtractedField<>(null, null);

    @SuppressWarnings("unchecked")
    public static <T> ExtractedField<T> empty() {
        return (ExtractedField<T>) EMPTY;
    }

    public static <T> ExtractedField<T> of(T value, BigDecimal confidence) {
        return value == null ? empty() : new ExtractedField<>(value, confidence);
    }

    /**
     * Textract reports confidence as a percentage; the ocr_confidence column is a 0..1
     * NUMERIC(4,3). Converts and rounds in one place so no caller has to remember the scale.
     */
    public static <T> ExtractedField<T> fromPercent(T value, Float percent) {
        if (value == null) return empty();
        BigDecimal c = percent == null
                ? null
                : BigDecimal.valueOf(percent).movePointLeft(2).setScale(3, java.math.RoundingMode.HALF_UP);
        return new ExtractedField<>(value, c);
    }

    public boolean isPresent() { return value != null; }
}
