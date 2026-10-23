package nz.amldock.individual;

import nz.amldock.ownership.NodeType;

import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * CSV rows for the owners registers' export. Mirrors what the browser used to build
 * (frontend/src/pages/cdd/BeneficialOwnersPage.jsx and CddExceptionsPage.jsx), so moving the
 * export to the server changes where the file is made, not what is in it.
 */
final class IndividualCsv {

    static final String REGISTER_HEADERS = "Name,Type,Date of birth,Country of residence,Property,Deal";
    static final String EXCEPTION_HEADERS = "Name,Type,Verified,Property,Deal";

    private IndividualCsv() {}

    static String registerRow(IndividualRowDto r) {
        return line(r.displayName(), typeLabel(r.nodeType()),
                r.dateOfBirth() == null ? "" : r.dateOfBirth().toString(),
                countryName(r.countryOfResidence()),
                r.propertyAddress(), r.dealReference());
    }

    static String exceptionRow(IndividualRowDto r) {
        return line(r.displayName(), typeLabel(r.nodeType()),
                r.verifiedAt() == null ? "" : r.verifiedAt().toString(),
                r.propertyAddress(), r.dealReference());
    }

    /** Same labels as frontend/src/api/ownership.js: the enum in sentence case, OTHER as "Other entity". */
    static String typeLabel(NodeType t) {
        if (t == null) return "";
        if (t == NodeType.OTHER) return "Other entity";
        String words = t.name().replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }

    /** English country name for an ISO alpha-2 code, falling back to the code itself. */
    static String countryName(String code) {
        if (code == null || code.isBlank()) return "";
        // Only real ISO codes: the JDK names user-assigned ones too ("ZZ" is "Unknown Region").
        if (!ISO_COUNTRIES.contains(code.toUpperCase(Locale.ROOT))) return code;
        String name = Locale.of("", code).getDisplayCountry(Locale.ENGLISH);
        return name == null || name.isBlank() ? code : name;
    }

    private static final java.util.Set<String> ISO_COUNTRIES = java.util.Set.of(Locale.getISOCountries());

    static String line(String... cells) {
        return Stream.of(cells).map(IndividualCsv::escape).collect(Collectors.joining(","));
    }

    /** A formula character after any character a spreadsheet might split cells on. */
    private static final Pattern AFTER_SEPARATOR = Pattern.compile("([,;\\t|\\r\\n]\\s*)([=+\\-@])");
    /** A formula character at the start of the cell, leading whitespace allowed. */
    private static final Pattern LEADING_FORMULA = Pattern.compile("^[\\t\\r]|^\\s*[=+\\-@]");

    /**
     * One cell, safe to open in any spreadsheet. Every cell here is a name, country, address or
     * date someone typed or the app formatted, never a number, so these rules cost nothing
     * legitimate:
     * <ol>
     *   <li>a formula character ({@code = + - @}) right after a separator ({@code , ; | tab},
     *       line break, optionally then spaces) gets an apostrophe, so text like
     *       {@code x;=HYPERLINK(...)} can't become a live formula in a spreadsheet that splits on
     *       {@code ;} (security scan F10);</li>
     *   <li>a cell that would open as a formula (leading {@code = + - @}, even after spaces, or a
     *       leading tab or CR) is prefixed with an apostrophe so it opens as text (C-14);</li>
     *   <li>every cell is quoted, inner quotes doubled (RFC 4180 allows it on any field), so no
     *       separator inside a value can split it, whatever separator the reader uses.</li>
     * </ol>
     */
    static String escape(String value) {
        String s = value == null ? "" : value;
        s = AFTER_SEPARATOR.matcher(s).replaceAll("$1'$2");
        if (LEADING_FORMULA.matcher(s).find()) s = "'" + s;
        return '"' + s.replace("\"", "\"\"") + '"';
    }
}
