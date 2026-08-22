package nz.amldock.document.ocr;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The MRZ path, which is the only extraction in the system that can prove itself right.
 *
 * <p>No mocks and no AWS: {@link MrzParser} is pure, which is why the check-digit arithmetic is
 * worth testing directly rather than through a Textract response.
 *
 * <p>Fixtures are the ICAO 9303 specimen (ANNA MARIA ERIKSSON), so the expected check digits come
 * from the published standard rather than from this implementation agreeing with itself.
 */
class MrzParserTest {

    static final String LINE_1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
    static final String LINE_2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";

    @Test
    void parsesTheIcaoSpecimen() {
        Optional<MrzParser.Mrz> parsed = MrzParser.parseLines(LINE_1, LINE_2);

        assertThat(parsed).isPresent();
        MrzParser.Mrz mrz = parsed.get();
        // Given names first, surname last — reading order, not MRZ order.
        assertThat(mrz.fullName()).isEqualTo("ANNA MARIA ERIKSSON");
        assertThat(mrz.dateOfBirth()).isEqualTo(LocalDate.of(1974, 8, 12));
        assertThat(mrz.expiryDate()).isEqualTo(LocalDate.of(2012, 4, 15));
        assertThat(mrz.compositeValid()).isTrue();
    }

    @Test
    void dropsADateWhoseCheckDigitFails() {
        // One digit of the birth date changed: 740812 -> 750812. The stated check digit no longer
        // agrees, which is exactly the misread this path exists to catch.
        String corrupted = LINE_2.substring(0, 13) + "750812" + LINE_2.substring(19);

        MrzParser.Mrz mrz = MrzParser.parseLines(LINE_1, corrupted).orElseThrow();

        // Discarded rather than stored with lower confidence — an unverifiable date of birth on
        // an AML record is worse than a missing one.
        assertThat(mrz.dateOfBirth()).isNull();
        // The untouched field is unaffected; one bad read does not poison the whole zone.
        assertThat(mrz.expiryDate()).isEqualTo(LocalDate.of(2012, 4, 15));
        assertThat(mrz.compositeValid()).isFalse();
    }

    @Test
    void rejectsASecondLineOfTheWrongLength() {
        // Every field is read by fixed offset, so a short line cannot be indexed safely. The
        // caller falls back to the query extractor rather than reading shifted garbage.
        assertThat(MrzParser.parseLines(LINE_1, LINE_2.substring(0, 40))).isEmpty();
    }

    @Test
    void findsTheZoneAmongOrdinaryOcrLines() {
        List<String> page = List.of(
                "NEW ZEALAND PASSPORT",
                "Surname / Nom",
                "ERIKSSON",
                LINE_1,
                LINE_2);

        assertThat(MrzParser.parse(page)).isPresent()
                .get().extracting(MrzParser.Mrz::fullName).isEqualTo("ANNA MARIA ERIKSSON");
    }

    @Test
    void toleratesSpacesSprayedThroughTheZone() {
        // OCR routinely inserts spaces into the MRZ; the zone itself contains none.
        List<String> page = List.of(LINE_1, "L898902C3 6UTO 7408122F 1204159ZE184226B<<<<<10");

        assertThat(MrzParser.parse(page)).isPresent()
                .get().extracting(MrzParser.Mrz::dateOfBirth).isEqualTo(LocalDate.of(1974, 8, 12));
    }

    @Test
    void handlesBothLinesReturnedAsOneBlock() {
        assertThat(MrzParser.parse(List.of(LINE_1 + LINE_2))).isPresent()
                .get().extracting(MrzParser.Mrz::fullName).isEqualTo("ANNA MARIA ERIKSSON");
    }

    @Test
    void returnsEmptyWhenThereIsNoZoneAtAll() {
        assertThat(MrzParser.parse(List.of("DRIVER LICENCE", "SHARMA", "05/10/1988"))).isEmpty();
    }

    @Test
    void checkDigitAlphabetFollowsTheStandard() {
        assertThat(MrzParser.charValue('0')).isZero();
        assertThat(MrzParser.charValue('9')).isEqualTo(9);
        assertThat(MrzParser.charValue('A')).isEqualTo(10);
        assertThat(MrzParser.charValue('Z')).isEqualTo(35);
        assertThat(MrzParser.charValue('<')).isZero();
    }

    @Test
    void checkDigitRejectsCharactersOutsideTheAlphabet() {
        // A lowercase letter is not in the MRZ alphabet; it must fail rather than score as zero,
        // or a misread would validate.
        assertThat(MrzParser.checkDigitMatches("74081a", '2')).isFalse();
    }
}
