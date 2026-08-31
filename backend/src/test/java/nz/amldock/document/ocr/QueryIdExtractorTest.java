package nz.amldock.document.ocr;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.textract.model.Block;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reconciling the readings a card gives back.
 *
 * <p>Several fields are asked for more than once, because a great many IDs never print the label
 * the obvious question matches — no "expiry" on the card, no combined name on the card. Those
 * answers then have to become one value, and every way that can go wrong is here.
 */
class QueryIdExtractorTest {

    private static final LocalDate EXPIRY = LocalDate.of(2030, 8, 15);

    private static Block answer(String text, Float confidence) {
        return Block.builder().text(text).confidence(confidence).build();
    }

    private static ExtractedField<LocalDate> onDate(int year, int month, int day) {
        return ExtractedField.fromPercent(LocalDate.of(year, month, day), 99.0f);
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

    // ── The third expiry reading ────────────────────────────────────────────

    /** The point of the third question: an NZ licence prints "6. Expires" and nothing else. */
    @Test
    void readsTheExpiresAnswerWhenTheOtherTwoQuestionsFoundNothing() {
        var chosen = QueryIdExtractor.chooseExpiry(null, null, answer("Expires 15/08/2030", 96.5f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
        assertThat(chosen.confidence()).isEqualByComparingTo("0.965");
    }

    /** It joins the same contest as the others: better read wins, ties go to the incumbent. */
    @Test
    void takesTheExpiresAnswerWhenItIsMoreConfident() {
        var chosen = QueryIdExtractor.chooseExpiry(
                answer("15/08/2030", 70.0f), answer("15/08/2030", 80.0f), answer("15/08/2030", 99.1f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
        assertThat(chosen.confidence()).isEqualByComparingTo("0.991");
    }

    /** And the not-earlier guard still holds against it — an issue date is never an expiry. */
    @Test
    void neverTakesAnExpiresAnswerEarlierThanTheIncumbent() {
        var chosen = QueryIdExtractor.chooseExpiry(
                answer("15/08/2030", 60.0f), null, answer("15/08/2020", 99.9f));

        assertThat(chosen.value()).isEqualTo(EXPIRY);
    }

    // ── The date of birth posing as an expiry ───────────────────────────────

    /**
     * The reported failure: the front of a licence carries no expiry at all — it is on the back —
     * so the expiry question was answered with the only date on the image, the date of birth.
     */
    @Test
    void rejectsAnExpiryThatIsTheDateOfBirth() {
        var dob = onDate(1988, 4, 12);

        assertThat(QueryIdExtractor.rejectDobEcho(onDate(1988, 4, 12), dob).isPresent()).isFalse();
    }

    /** Nobody's document expires before they were born, whatever confidence says. */
    @Test
    void rejectsAnExpiryEarlierThanTheDateOfBirth() {
        assertThat(QueryIdExtractor.rejectDobEcho(onDate(1980, 1, 1), onDate(1988, 4, 12)).isPresent())
                .isFalse();
    }

    /** The ordinary case is left alone. */
    @Test
    void keepsAnExpiryLaterThanTheDateOfBirth() {
        assertThat(QueryIdExtractor.rejectDobEcho(onDate(2030, 8, 15), onDate(1988, 4, 12)).value())
                .isEqualTo(EXPIRY);
    }

    /** With no date of birth read there is nothing to compare against, so the expiry stands. */
    @Test
    void keepsTheExpiryWhenTheDateOfBirthWasNotRead() {
        assertThat(QueryIdExtractor.rejectDobEcho(onDate(2030, 8, 15), ExtractedField.empty()).value())
                .isEqualTo(EXPIRY);
    }

    // ── Composing a name from its halves ────────────────────────────────────

    /** Cards that print a combined name are unaffected — nothing to compose from. */
    @Test
    void keepsTheFullNameWhenThereAreNoHalvesToCompose() {
        var chosen = QueryIdExtractor.chooseName(answer("JANE MARIE SMITH", 97.0f), null, null);

        assertThat(chosen.value()).isEqualTo("JANE MARIE SMITH");
    }

    /** The point of the two extra questions: an NZ licence names its holder on two lines. */
    @Test
    void composesTheHalvesWhenThereIsNoFullNameOnTheCard() {
        var chosen = QueryIdExtractor.chooseName(null, answer("JANE MARIE", 96.0f), answer("SMITH", 98.0f));

        assertThat(chosen.value()).isEqualTo("JANE MARIE SMITH");
    }

    /** A composite is only as trustworthy as its weaker half. */
    @Test
    void takesTheLowerConfidenceOfTheTwoHalves() {
        var chosen = QueryIdExtractor.chooseName(null, answer("JANE MARIE", 96.0f), answer("SMITH", 98.0f));

        assertThat(chosen.confidence()).isEqualByComparingTo("0.960");
    }

    /** An unmeasured half makes the whole composite unmeasured, so it can never displace a measured name. */
    @Test
    void treatsAComposedNameAsUnmeasuredWhenEitherHalfIs() {
        var chosen = QueryIdExtractor.chooseName(null, answer("JANE MARIE", null), answer("SMITH", 98.0f));

        assertThat(chosen.value()).isEqualTo("JANE MARIE SMITH");
        assertThat(chosen.confidence()).isNull();
    }

    /**
     * Half a name is worse than none: written to the record it would read as a whole one, and a
     * surname alone is indistinguishable from a full name that happens to be short.
     */
    @Test
    void refusesToComposeFromOneHalfAlone() {
        assertThat(QueryIdExtractor.chooseName(null, null, answer("SMITH", 99.0f)).isPresent()).isFalse();
        assertThat(QueryIdExtractor.chooseName(null, answer("JANE", 99.0f), null).isPresent()).isFalse();
    }

    /** The full-name question names the field being asked for, so it holds a tie. */
    @Test
    void prefersTheFullNameWhenItIsEquallyConfident() {
        var chosen = QueryIdExtractor.chooseName(
                answer("JANE M SMITH", 90.0f), answer("JANE MARIE", 90.0f), answer("SMITH", 90.0f));

        assertThat(chosen.value()).isEqualTo("JANE M SMITH");
    }

    /** But the labelled halves take it when both are read strictly better. */
    @Test
    void takesTheComposedNameWhenBothHalvesAreMoreConfident() {
        var chosen = QueryIdExtractor.chooseName(
                answer("JANE M SMITH", 71.0f), answer("JANE MARIE", 99.0f), answer("SMITH", 98.0f));

        assertThat(chosen.value()).isEqualTo("JANE MARIE SMITH");
    }

    @Test
    void yieldsNoNameWhenTheCardAnsweredNothing() {
        assertThat(QueryIdExtractor.chooseName(null, null, null).isPresent()).isFalse();
    }

    // ── The query list itself ───────────────────────────────────────────────

    /**
     * A tripwire, not a tautology. An alias never leaves QueryIdExtractor: answersByAlias collects
     * every alias Textract returns, and anything no answers.get() asks for is dropped with no log
     * and no error — indistinguishable from an illegible card. So a query added without its lookup
     * is a silent no-op, and this test is the thing that makes adding one a deliberate act.
     */
    @Test
    void asksForExactlyTheAliasesItReadsBack() {
        assertThat(QueryIdExtractor.QUERIES).extracting(q -> q.alias())
                .containsExactlyInAnyOrder(
                        QueryIdExtractor.ALIAS_FULL_NAME,
                        QueryIdExtractor.ALIAS_GIVEN_NAMES,
                        QueryIdExtractor.ALIAS_SURNAME,
                        QueryIdExtractor.ALIAS_DOB,
                        QueryIdExtractor.ALIAS_EXPIRY,
                        QueryIdExtractor.ALIAS_VALIDITY,
                        QueryIdExtractor.ALIAS_EXPIRES);
    }

    /** Textract rejects a 16th query outright, and IdExtractionService will not retry that. */
    @Test
    void staysWithinTextractsQueryLimit() {
        assertThat(QueryIdExtractor.QUERIES).hasSizeLessThanOrEqualTo(QueryIdExtractor.MAX_QUERIES);
    }
}
