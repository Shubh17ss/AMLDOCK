package nz.amldock.document.ocr;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * ICAO 9303 TD3 machine-readable zone — the two 44-character lines at the foot of every
 * compliant passport.
 *
 * <p>Parsed rather than queried because the layout is fixed <em>and check-digited</em>. Every
 * date carries its own check digit, so a misread is detectable rather than merely unlikely.
 * That is the whole reason this path exists: it is the only extraction in the system that can
 * prove itself right. A field whose check digit fails is discarded, not downgraded — keeping it
 * would throw away the guarantee we came here for.
 *
 * <p>Pure and static by design, so the check-digit maths is testable without AWS.
 */
public final class MrzParser {

    private MrzParser() {}

    private static final int LINE_LENGTH = 44;
    private static final int[] WEIGHTS = {7, 3, 1};

    /**
     * @param fullName        given names followed by surname, or null if line 1 was unreadable
     * @param dateOfBirth     null when absent or when its check digit failed
     * @param expiryDate      null when absent or when its check digit failed
     * @param compositeValid  whether the final check digit over the whole line agrees
     */
    public record Mrz(String fullName,
                      LocalDate dateOfBirth,
                      LocalDate expiryDate,
                      boolean compositeValid) {}

    /**
     * Finds and parses the MRZ among raw OCR lines.
     *
     * @return empty when no well-formed MRZ is present — a cropped or glared scan. The caller
     *         falls back to the query extractor rather than guessing.
     */
    public static Optional<Mrz> parse(List<String> ocrLines) {
        if (ocrLines == null) return Optional.empty();

        List<String> candidates = new ArrayList<>();
        for (String raw : ocrLines) {
            if (raw == null) continue;
            // OCR sprinkles spaces through the MRZ; the zone itself contains none.
            String s = raw.toUpperCase().replaceAll("\\s", "");
            if (s.length() >= 30 && s.matches("[A-Z0-9<]+")) candidates.add(s);
        }
        if (candidates.isEmpty()) return Optional.empty();

        // Some engines return both lines merged into one block.
        for (String c : candidates) {
            if (c.length() >= LINE_LENGTH * 2) {
                return parseLines(c.substring(0, LINE_LENGTH), c.substring(LINE_LENGTH, LINE_LENGTH * 2));
            }
        }
        if (candidates.size() < 2) return Optional.empty();

        // The MRZ is the last thing on the page, so search from the end.
        for (int i = candidates.size() - 1; i >= 1; i--) {
            Optional<Mrz> parsed = parseLines(candidates.get(i - 1), candidates.get(i));
            if (parsed.isPresent()) return parsed;
        }
        return Optional.empty();
    }

    /**
     * Parses one known pair of lines.
     *
     * <p>Line 2 must be exactly 44 characters: every field is read by fixed offset, so a line of
     * any other length cannot be indexed safely and is rejected rather than guessed at. Line 1 is
     * padded, because its tail is filler and OCR routinely clips it.
     */
    public static Optional<Mrz> parseLines(String line1, String line2) {
        if (line2 == null || line2.length() != LINE_LENGTH) return Optional.empty();
        if (line1 == null) return Optional.empty();

        String l1 = line1.length() >= LINE_LENGTH
                ? line1.substring(0, LINE_LENGTH)
                : line1 + "<".repeat(LINE_LENGTH - line1.length());

        String dobRaw    = line2.substring(13, 19);
        char   dobCd     = line2.charAt(19);
        String expiryRaw = line2.substring(21, 27);
        char   expiryCd  = line2.charAt(27);

        LocalDate dob = checkDigitMatches(dobRaw, dobCd)
                ? IdDateParser.parseMrzDateOfBirth(dobRaw) : null;
        LocalDate expiry = checkDigitMatches(expiryRaw, expiryCd)
                ? IdDateParser.parseMrzExpiry(expiryRaw) : null;

        // The composite spans document number, both dates and the personal number, each with its
        // own check digit. The document number is read only to feed this — it is not retained.
        String composite = line2.substring(0, 10) + line2.substring(13, 20)
                + line2.substring(21, 28) + line2.substring(28, 43);
        boolean compositeValid = checkDigitMatches(composite, line2.charAt(43));

        String name = parseName(l1);

        // Nothing survived: not an MRZ, or too badly read to be one.
        if (name == null && dob == null && expiry == null) return Optional.empty();
        return Optional.of(new Mrz(name, dob, expiry, compositeValid));
    }

    /** Line 1 is {@code P<ISS SURNAME<<GIVEN<NAMES<<<...}; returns "GIVEN NAMES SURNAME". */
    private static String parseName(String line1) {
        if (line1.length() <= 5) return null;
        String namePart = line1.substring(5);
        String[] halves = namePart.split("<<", 2);

        String surname = tidy(halves[0]);
        String given = halves.length > 1 ? tidy(halves[1]) : "";

        if (surname.isEmpty() && given.isEmpty()) return null;
        if (given.isEmpty()) return surname;
        if (surname.isEmpty()) return given;
        return given + " " + surname;
    }

    private static String tidy(String s) {
        return s.replace('<', ' ').replaceAll("\\s+", " ").trim();
    }

    /**
     * ICAO 9303 check digit: weights cycle 7, 3, 1; digits are themselves, letters are
     * A=10..Z=35, filler is 0; the sum modulo 10 must equal the stated digit.
     */
    static boolean checkDigitMatches(String data, char expected) {
        if (expected < '0' || expected > '9') return false;
        int sum = 0;
        for (int i = 0; i < data.length(); i++) {
            sum += charValue(data.charAt(i)) * WEIGHTS[i % WEIGHTS.length];
        }
        return sum % 10 == expected - '0';
    }

    static int charValue(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'A' && c <= 'Z') return c - 'A' + 10;
        if (c == '<') return 0;
        return -1;   // poisons the sum, so an out-of-alphabet character fails the check
    }
}
