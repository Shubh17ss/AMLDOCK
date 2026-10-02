package nz.amldock.deal;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * What a country is worth to a deal's risk score.
 *
 * <p>One scale, used everywhere a country is named: the deal's foreign exposure, an entity's
 * jurisdiction of incorporation, an individual's country of residence. A single mapping rather
 * than one per question, because the same country carries the same concern however it arrived on
 * the file — and three copies of a 249-entry table would disagree within a release.
 *
 * <h2>The bands</h2>
 * <pre>
 * 6  South-East Asia, India, China (with Hong Kong and Macau), every African country
 * 3  South America, and every other Asian country — East, Central, South and the Middle East
 * 1  Europe, and North America taken to include Central America and the Caribbean
 * 0  New Zealand, Australia, the rest of Oceania, the Antarctic territories, and no answer
 * </pre>
 *
 * <p>Server-side only, and deliberately not mirrored in JavaScript. The Risk tab reads the
 * factors this produces back off the API rather than recomputing them, so there is nothing for a
 * second copy to be right about.
 *
 * <h2>Three placements worth knowing</h2>
 *
 * <p><strong>Russia sits in Europe at 1</strong> and <strong>Turkey in Asia at 3</strong>, which
 * is the UN geoscheme rather than a judgement about either. <strong>Hong Kong and Macau score
 * with China at 6</strong>: they are separately administered, and a structure routed through one
 * of them is not thereby a lesser concern than the same structure routed through Shenzhen.
 *
 * <p>The list is a partition — every code in {@code frontend/src/data/countries.js} appears in
 * exactly one band, which {@code CountryRiskTest} holds to. An unmapped or unrecognised code
 * scores 0 rather than throwing: a deal must not become unratable because someone stored a code
 * this class has never heard of.
 */
public final class CountryRisk {

    private CountryRisk() {}

    /**
     * The sentinel {@code CountrySelect} writes for "asked, and there is none", distinct from a
     * null that means nobody asked. Both score 0; only one of them is an answer, which is why
     * {@code DealRiskService} tells them apart when it lists what is still unanswered.
     */
    public static final String NONE = "NONE";

    private static final Set<String> SOUTH_EAST_ASIA = Set.of(
            "BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN");

    private static final Set<String> GREATER_CHINA = Set.of(
            "CN", "HK", "MO");

    private static final Set<String> AFRICA = Set.of(
            "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI",
            "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR",
            "LY", "MG", "MW", "ML", "MR", "MU", "YT", "MA", "MZ", "NA", "NE", "NG", "RE", "RW",
            "SH", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "EH",
            "ZM", "ZW");

    private static final Set<String> SOUTH_AMERICA = Set.of(
            "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR", "UY", "VE");

    /** Asia less South-East Asia, India and greater China — East, Central, South, Middle East. */
    private static final Set<String> REST_OF_ASIA = Set.of(
            "AF", "AM", "AZ", "BH", "BD", "BT", "GE", "IR", "IQ", "IL", "JP", "JO", "KZ", "KP",
            "KR", "KW", "KG", "LB", "MV", "MN", "NP", "OM", "PK", "PS", "QA", "SA", "LK", "SY",
            "TW", "TJ", "TR", "TM", "AE", "UZ", "YE");

    /** The UN scheme's Northern America plus Central America and the Caribbean. */
    private static final Set<String> NORTH_AMERICA = Set.of(
            "AI", "AG", "AW", "BS", "BB", "BZ", "BM", "BQ", "VG", "CA", "KY", "CR", "CU", "CW",
            "DM", "DO", "SV", "GL", "GD", "GP", "GT", "HT", "HN", "JM", "MQ", "MX", "MS", "NI",
            "PA", "PR", "BL", "KN", "LC", "MF", "PM", "VC", "SX", "TT", "TC", "US", "VI", "UM");

    private static final Set<String> EUROPE = Set.of(
            "AX", "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FO",
            "FI", "FR", "DE", "GI", "GR", "GG", "VA", "HU", "IS", "IE", "IM", "IT", "JE", "LV",
            "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "RU",
            "SM", "RS", "SK", "SI", "ES", "SJ", "SE", "CH", "UA", "GB");

    private static final Map<String, Integer> POINTS_BY_COUNTRY = buildIndex();

    private static Map<String, Integer> buildIndex() {
        Map<String, Integer> index = new HashMap<>(300);
        putAll(index, AFRICA, 6);
        putAll(index, SOUTH_EAST_ASIA, 6);
        putAll(index, GREATER_CHINA, 6);
        index.put("IN", 6);
        putAll(index, SOUTH_AMERICA, 3);
        putAll(index, REST_OF_ASIA, 3);
        putAll(index, NORTH_AMERICA, 1);
        putAll(index, EUROPE, 1);
        // Oceania, the Antarctic territories and anything unlisted fall through to 0 — see
        // pointsFor. Spelling them out would be a list whose only content is "nothing happens".
        return Map.copyOf(index);
    }

    private static void putAll(Map<String, Integer> index, Set<String> codes, int points) {
        for (String code : codes) {
            Integer clash = index.put(code, points);
            if (clash != null && clash != points) {
                // A code in two bands is a mapping that cannot be reasoned about, and it would
                // otherwise surface as a rating that quietly depends on declaration order.
                throw new IllegalStateException(code + " is in two risk bands");
            }
        }
    }

    /**
     * The points an ISO 3166-1 alpha-2 code carries. Null, blank, {@link #NONE} and anything
     * unrecognised all score 0.
     */
    public static int pointsFor(String countryCode) {
        if (countryCode == null || countryCode.isBlank()) return 0;
        return POINTS_BY_COUNTRY.getOrDefault(countryCode.trim().toUpperCase(), 0);
    }

    /** Every code that carries points, for the test that holds the mapping to the country list. */
    public static Set<String> mappedCodes() {
        return POINTS_BY_COUNTRY.keySet();
    }

    /** The bands, for a test that wants to assert one country landed where it was meant to. */
    public static List<Set<String>> bands() {
        return List.of(AFRICA, SOUTH_EAST_ASIA, GREATER_CHINA, SOUTH_AMERICA, REST_OF_ASIA,
                NORTH_AMERICA, EUROPE);
    }
}
