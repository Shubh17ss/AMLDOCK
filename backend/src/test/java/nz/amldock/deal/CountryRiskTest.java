package nz.amldock.deal;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * The country scale, held to the country list the UI actually offers.
 *
 * <p>Two properties, and the second is the one that will catch a real mistake. The bands must not
 * overlap — a country in two of them produces a score that depends on declaration order, which is
 * not something anyone could reason about from the file. And every code a user can pick must be
 * classified: an unmapped code silently scores 0, so a country quietly missing from the map is a
 * deal scored as though it named nowhere, and nothing anywhere would say so.
 *
 * <p>{@code countries.js} is read as the source of truth for what a user can pick, because it is
 * — {@code CountrySelect} renders exactly that array. Reaching across into the frontend from a
 * backend test is unusual and deliberate: the alternative is a second copy of 249 codes on this
 * side, which is the very thing the check exists to prevent.
 */
class CountryRiskTest {

    private static final Path COUNTRIES_JS =
            Path.of("..", "frontend", "src", "data", "countries.js");

    private static final Pattern CODE = Pattern.compile("\\{\\s*code:\\s*'([A-Z]{2})'");

    @Test
    void theBandsDoNotOverlap() {
        Set<String> seen = new HashSet<>();
        for (Set<String> band : CountryRisk.bands()) {
            for (String code : band) {
                assertThat(seen.add(code))
                        .as("%s is in more than one risk band", code)
                        .isTrue();
            }
        }
    }

    @Test
    void everyCountryTheUiOffersIsClassified() throws IOException {
        List<String> offered = codesFromCountriesJs();
        // Not a silent pass if the file moves: the assumption is about being able to read it at
        // all, and 249 codes is the shape it has had since it was written.
        assumeTrue(offered.size() > 200, "countries.js not readable from the test working dir");

        Set<String> unmapped = offered.stream()
                .filter(c -> !isZeroBandByDesign(c))
                .filter(c -> !CountryRisk.mappedCodes().contains(c))
                .collect(Collectors.toCollection(java.util.TreeSet::new));

        assertThat(unmapped)
                .as("these codes score 0 by omission rather than by decision — put each one in a"
                        + " band, or add it to the zero band in this test if 0 is the answer")
                .isEmpty();
    }

    @Test
    void theZeroBandIsReachableAndIsNotAnAccident() {
        // NZ and AU are the home countries and score nothing; the check above would pass whether
        // that was deliberate or an oversight, so it is asserted here on purpose.
        assertThat(CountryRisk.pointsFor("NZ")).isZero();
        assertThat(CountryRisk.pointsFor("AU")).isZero();
        assertThat(CountryRisk.mappedCodes()).doesNotContain("NZ", "AU");
    }

    /**
     * The codes that score 0 by decision rather than by omission: New Zealand and Australia, the
     * rest of Oceania, and the Antarctic and Indian Ocean territories nobody resides in.
     *
     * <p>Spelled out here rather than in {@code CountryRisk}, where a band whose entries all mean
     * "nothing happens" would be a list the production code never reads.
     */
    private static boolean isZeroBandByDesign(String code) {
        return ZERO_BY_DESIGN.contains(code);
    }

    private static final Set<String> ZERO_BY_DESIGN = Set.of(
            "AU", "NZ",
            // Oceania
            "AS", "CK", "FJ", "PF", "GU", "KI", "MH", "FM", "NR", "NC", "NU", "NF", "MP", "PW",
            "PG", "PN", "WS", "SB", "TK", "TO", "TV", "VU", "WF", "CX", "CC",
            // Antarctic and Indian Ocean territories
            "AQ", "BV", "HM", "TF", "GS", "IO");

    private static List<String> codesFromCountriesJs() throws IOException {
        if (!Files.exists(COUNTRIES_JS)) return List.of();
        String js = Files.readString(COUNTRIES_JS, StandardCharsets.UTF_8);
        Matcher m = CODE.matcher(js);
        List<String> codes = new java.util.ArrayList<>();
        while (m.find()) codes.add(m.group(1));
        return codes;
    }
}
