package nz.amldock.individual;

import nz.amldock.ownership.NodeType;

import java.util.Locale;
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

    /** RFC 4180: quote a field holding a comma, quote or line break, doubling inner quotes. */
    static String escape(String value) {
        String s = value == null ? "" : value;
        boolean quote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0;
        return quote ? '"' + s.replace("\"", "\"\"") + '"' : s;
    }
}
