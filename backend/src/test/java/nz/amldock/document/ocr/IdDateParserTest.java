package nz.amldock.document.ocr;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Date reading, where the expensive mistake is silent rather than loud.
 */
class IdDateParserTest {

    /**
     * The reason this class exists. NZ and AU both write day first, so 03/04 is 3 April. A
     * month-first reading would parse just as cleanly as 4 March and nothing downstream could
     * tell the difference — the record would simply be wrong.
     */
    @Test
    void readsAmbiguousDatesDayFirst() {
        assertThat(IdDateParser.parseDayFirst("03/04/2030")).isEqualTo(LocalDate.of(2030, 4, 3));
    }

    @ParameterizedTest
    @ValueSource(strings = {"15/08/2030", "15-08-2030", "15.08.2030", "15 08 2030"})
    void acceptsTheSeparatorsIdsActuallyUse(String input) {
        assertThat(IdDateParser.parseDayFirst(input)).isEqualTo(LocalDate.of(2030, 8, 15));
    }

    @ParameterizedTest
    @ValueSource(strings = {"15 AUG 2030", "15 Aug 2030", "15 August 2030"})
    void acceptsSpelledMonths(String input) {
        assertThat(IdDateParser.parseDayFirst(input)).isEqualTo(LocalDate.of(2030, 8, 15));
    }

    @Test
    void pullsTheDateOutOfProse() {
        // Textract answers a query with whatever text surrounds the answer.
        assertThat(IdDateParser.parseDayFirst("Expires 15/08/2030"))
                .isEqualTo(LocalDate.of(2030, 8, 15));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "not a date", "32/13/2030", "SEE REVERSE"})
    void returnsNullRatherThanGuessing(String input) {
        assertThat(IdDateParser.parseDayFirst(input)).isNull();
    }

    @Test
    void nullInputIsNullOutput() {
        assertThat(IdDateParser.parseDayFirst(null)).isNull();
    }

    /* ---------- MRZ, which has no century ---------- */

    @Test
    void birthYearResolvesBackwards() {
        // Nobody is born in the future, so a two-digit year ahead of today belongs to the 1900s.
        assertThat(IdDateParser.parseMrzDateOfBirth("740812")).isEqualTo(LocalDate.of(1974, 8, 12));
    }

    @Test
    void expiryAlwaysResolvesForwards() {
        // A travel document is issued for at most ten years, so a 19xx expiry is not something
        // anyone is presenting at a property settlement.
        assertThat(IdDateParser.parseMrzExpiry("120415")).isEqualTo(LocalDate.of(2012, 4, 15));
    }

    @ParameterizedTest
    @ValueSource(strings = {"740899", "741332", "74081", "abcdef", "000000"})
    void rejectsImpossibleMrzDates(String input) {
        assertThat(IdDateParser.parseMrzDateOfBirth(input)).isNull();
    }
}
