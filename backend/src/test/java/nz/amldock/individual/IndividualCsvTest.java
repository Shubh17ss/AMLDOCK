package nz.amldock.individual;

import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** The server-built register export reads the same as the one the browser used to build. */
class IndividualCsvTest {

    @Test
    void fieldsWithCommasQuotesOrLineBreaksAreQuoted() {
        assertThat(IndividualCsv.escape("plain")).isEqualTo("plain");
        assertThat(IndividualCsv.escape("12 Queen St, Auckland")).isEqualTo("\"12 Queen St, Auckland\"");
        assertThat(IndividualCsv.escape("The \"Smith\" Trust")).isEqualTo("\"The \"\"Smith\"\" Trust\"");
        assertThat(IndividualCsv.escape("line\nbreak")).isEqualTo("\"line\nbreak\"");
        assertThat(IndividualCsv.escape(null)).isEmpty();
    }

    @Test
    void typeLabelsMatchTheFrontend() {
        assertThat(IndividualCsv.typeLabel(NodeType.INDIVIDUAL)).isEqualTo("Individual");
        assertThat(IndividualCsv.typeLabel(NodeType.PRIVATE_COMPANY)).isEqualTo("Private company");
        assertThat(IndividualCsv.typeLabel(NodeType.OTHER)).isEqualTo("Other entity");
    }

    @Test
    void registerRowSpellsOutTheCountry() {
        IndividualRowDto r = row("NZ", null);
        assertThat(IndividualCsv.registerRow(r))
                .isEqualTo("Mei Chen,Individual,1980-02-01,New Zealand,\"1 Queen St, Auckland\",D-1");
    }

    @Test
    void anUnrecordedCountryIsBlankAndAnUnknownCodeStaysACode() {
        assertThat(IndividualCsv.countryName(null)).isEmpty();
        assertThat(IndividualCsv.countryName("ZZ")).isEqualTo("ZZ");
    }

    @Test
    void exceptionRowIsDatedByVerification() {
        IndividualRowDto r = row("NZ", Instant.parse("2026-09-01T10:00:00Z"));
        assertThat(IndividualCsv.exceptionRow(r))
                .isEqualTo("Mei Chen,Individual,2026-09-01T10:00:00Z,\"1 Queen St, Auckland\",D-1");
    }

    private static IndividualRowDto row(String country, Instant verifiedAt) {
        return new IndividualRowDto(1L, NodeType.INDIVIDUAL, 2L, "D-1", "1 Queen St, Auckland", "Mei Chen",
                LocalDate.of(1980, 2, 1), country, Set.of(), NodeVerificationStatus.VERIFIED_WITH_EXCEPTION,
                verifiedAt);
    }
}
