package nz.amldock.document.ocr;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.textract.model.Block;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Choosing between the two expiry readings.
 *
 * <p>The card is asked twice — once for its expiry date, once for how long it is valid — because
 * a great many IDs never print the word "expiry". Two answers then have to become one, and every
 * way that can go wrong is here.
 */
class QueryIdExtractorTest {

    private static final LocalDate EXPIRY = LocalDate.of(2030, 8, 15);

    private static Block answer(String text, Float confidence) {
        return Block.builder().text(text).confidence(confidence).build();
    }

    /** The point of the second question: a card reading "Valid to 15/08/2030" now yields a date. */
    @Test
    void readsTheValidityAnswerWhenTheExpiryQuestionFoundNothing() {
        var chosen = QueryIdExtractor.chooseExpiry(null, answer("Valid to 15/08/2030", 98.4f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
        assertThat(chosen.confidence()).isEqualByComparingTo("0.984");
    }

    /** And the reverse: adding the question must not disturb cards that already worked. */
    @Test
    void keepsTheExpiryAnswerWhenTheValidityQuestionFoundNothing() {
        assertThat(QueryIdExtractor.chooseExpiry(answer("15/08/2030", 97.0f), null).value())
                .isEqualTo(EXPIRY);
    }

    @Test
    void yieldsNothingWhenNeitherQuestionWasAnswered() {
        assertThat(QueryIdExtractor.chooseExpiry(null, null).isPresent()).isFalse();
    }

    /**
     * Textract answers a query with whatever text it found, which is not always a date. A block
     * that parses to nothing must not shadow the one that does.
     */
    @Test
    void ignoresAnAnswerThatIsNotADate() {
        var chosen = QueryIdExtractor.chooseExpiry(answer("NEW ZEALAND", 99.9f), answer("15/08/2030", 60.0f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
    }

    /** The expiry question names the field being asked for, so it holds a tie. */
    @Test
    void prefersTheExpiryAnswerWhenBothAreEquallyConfident() {
        var chosen = QueryIdExtractor.chooseExpiry(answer("15/08/2030", 90.0f), answer("16/08/2030", 90.0f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
    }

    /**
     * The ordinary case where both questions land on the same printed line: same date, two
     * readings of it, and the better-read one is the one recorded.
     */
    @Test
    void takesTheValidityAnswerWhenItIsMoreConfident() {
        var chosen = QueryIdExtractor.chooseExpiry(answer("15/08/2030", 71.0f), answer("Valid to 15/08/2030", 99.2f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
        assertThat(chosen.confidence()).isEqualByComparingTo("0.992");
    }

    /** A later date is not on its own a reason to switch — the reading has to be better too. */
    @Test
    void keepsTheExpiryAnswerWhenTheValidityAnswerIsLessConfident() {
        var chosen = QueryIdExtractor.chooseExpiry(answer("15/08/2030", 99.0f), answer("20/08/2030", 60.0f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
    }

    /**
     * The predictable failure: a card printing "Valid from 15/08/2020 to 15/08/2030" can answer
     * the validity question with the start of the window. An issue date is never an expiry, so
     * confidence does not get to argue.
     */
    @Test
    void neverTakesADateEarlierThanTheExpiryAnswer() {
        var chosen = QueryIdExtractor.chooseExpiry(answer("15/08/2030", 80.0f), answer("15/08/2020", 99.9f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
    }

    /**
     * An expired ID is a normal thing to scan and a fact the reviewer needs. Nothing here
     * filters on today's date — the guard above compares the two readings, not the calendar.
     */
    @Test
    void keepsAnExpiryThatHasAlreadyPassed() {
        var past = LocalDate.of(2019, 3, 4);

        assertThat(QueryIdExtractor.chooseExpiry(answer("04/03/2019", 95.0f), null).value()).isEqualTo(past);
    }
}
