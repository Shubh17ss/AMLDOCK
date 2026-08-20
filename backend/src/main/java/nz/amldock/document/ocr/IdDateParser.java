package nz.amldock.document.ocr;

import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dates off an NZ or AU identity document.
 *
 * <p><strong>Day-first, always.</strong> Both countries write 03/04/2030 as 3 April. Admitting a
 * month-first pattern would silently transpose every ambiguous date — 03/04 would parse cleanly
 * as 4 March and there would be nothing downstream to catch it. A date we cannot parse becomes
 * null instead, which is visible.
 */
public final class IdDateParser {

    private IdDateParser() {}

    /** Textract answers are often prose ("Expires 15 AUG 2030"), so the date is pulled out first. */
    private static final Pattern DATE_LIKE = Pattern.compile(
            "\\d{1,2}\\s*[/.\\-\\s]\\s*(?:\\d{1,2}|[A-Za-z]{3,9})\\s*[/.\\-\\s]\\s*\\d{2,4}");

    private static final List<DateTimeFormatter> FORMATS = List.of(
            caseInsensitive("d/M/uuuu"),
            caseInsensitive("d-M-uuuu"),
            caseInsensitive("d.M.uuuu"),
            caseInsensitive("d MMM uuuu"),
            caseInsensitive("d MMMM uuuu"));

    /**
     * Month names are matched without regard to case. IDs print them however they like -- an NZ
     * licence uses "AUG" -- and the default parser would reject anything but "Aug".
     */
    private static DateTimeFormatter caseInsensitive(String pattern) {
        return new DateTimeFormatterBuilder()
                .parseCaseInsensitive()
                .appendPattern(pattern)
                .toFormatter(Locale.ENGLISH);
    }

    /**
     * @return the date, or null if the text holds nothing parseable as one.
     */
    public static LocalDate parseDayFirst(String text) {
        if (text == null || text.isBlank()) return null;

        Matcher m = DATE_LIKE.matcher(text);
        String candidate = m.find() ? m.group() : text.trim();

        // Normalise every separator to a single space so one set of patterns covers
        // "15/08/2030", "15-08-2030", "15 . 08 . 2030" and "15 AUG 2030" alike.
        String normalised = candidate
                .replaceAll("[/.\\-]", " ")
                .replaceAll("\\s+", " ")
                .trim();

        String spaced = normalised.replace(' ', '/');
        for (DateTimeFormatter f : FORMATS) {
            // The formatters carry their own separators, so try both the slashed and spaced forms.
            for (String attempt : List.of(spaced, normalised)) {
                try {
                    return LocalDate.parse(attempt, f);
                } catch (DateTimeParseException ignored) {
                    // Fall through to the next pattern — an unparseable date is a null, not a throw.
                }
            }
        }
        return null;
    }

    /**
     * The MRZ's YYMMDD, which has no century. Birth dates resolve backwards from today: a
     * two-digit year after the current one must belong to the previous century, because nobody
     * is born in the future.
     */
    public static LocalDate parseMrzDateOfBirth(String yymmdd) {
        return parseMrz(yymmdd, true);
    }

    /**
     * Expiry always resolves into the 2000s. A travel document is issued for at most ten years,
     * so a 19xx expiry cannot be a document anyone is presenting.
     */
    public static LocalDate parseMrzExpiry(String yymmdd) {
        return parseMrz(yymmdd, false);
    }

    private static LocalDate parseMrz(String yymmdd, boolean pastOnly) {
        if (yymmdd == null || !yymmdd.matches("\\d{6}")) return null;
        int yy = Integer.parseInt(yymmdd.substring(0, 2));
        int mm = Integer.parseInt(yymmdd.substring(2, 4));
        int dd = Integer.parseInt(yymmdd.substring(4, 6));

        int currentYy = Year.now().getValue() % 100;
        int year = pastOnly
                ? (yy > currentYy ? 1900 + yy : 2000 + yy)
                : 2000 + yy;
        try {
            return LocalDate.of(year, mm, dd);
        } catch (java.time.DateTimeException e) {
            return null;   // 00 month/day, or a 31st that isn't
        }
    }
}
