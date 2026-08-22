package nz.amldock.document.ocr;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.textract.model.BadDocumentException;
import software.amazon.awssdk.services.textract.model.DocumentTooLargeException;
import software.amazon.awssdk.services.textract.model.InvalidS3ObjectException;
import software.amazon.awssdk.services.textract.model.ProvisionedThroughputExceededException;
import software.amazon.awssdk.services.textract.model.ThrottlingException;
import software.amazon.awssdk.services.textract.model.UnsupportedDocumentException;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The two decisions the worker makes that are worth pinning down without a database: whether a
 * failure deserves another attempt, and what single confidence a three-field document reports.
 */
class IdExtractionServiceTest {

    /* ---------- retry classification ---------- */

    @Test
    void throttlingIsWorthRetrying() {
        assertThat(IdExtractionService.isRetryable(
                ProvisionedThroughputExceededException.builder().build())).isTrue();
        assertThat(IdExtractionService.isRetryable(ThrottlingException.builder().build())).isTrue();
    }

    @Test
    void networkTroubleIsWorthRetrying() {
        assertThat(IdExtractionService.isRetryable(
                SdkClientException.builder().message("connection reset").build())).isTrue();
    }

    @Test
    void serverSideErrorsAreWorthRetrying() {
        assertThat(IdExtractionService.isRetryable(
                AwsServiceException.builder().statusCode(503).build())).isTrue();
    }

    @Test
    void anUnreadableDocumentIsNot() {
        // Retrying these burns Textract quota on a scan that will never parse, and delays the
        // broker seeing that it failed.
        assertThat(IdExtractionService.isRetryable(UnsupportedDocumentException.builder().build())).isFalse();
        assertThat(IdExtractionService.isRetryable(BadDocumentException.builder().build())).isFalse();
        assertThat(IdExtractionService.isRetryable(DocumentTooLargeException.builder().build())).isFalse();
        assertThat(IdExtractionService.isRetryable(InvalidS3ObjectException.builder().build())).isFalse();
    }

    @Test
    void aClientSideErrorIsNot() {
        assertThat(IdExtractionService.isRetryable(
                AwsServiceException.builder().statusCode(400).build())).isFalse();
    }

    @Test
    void anUnrecognisedFailureIsNotRetried() {
        // A bug in our own code should surface as one visible failure, not three identical ones.
        assertThat(IdExtractionService.isRetryable(new NullPointerException())).isFalse();
    }

    /* ---------- confidence ---------- */

    @Test
    void reportsTheWeakestFieldNotTheAverage() {
        ExtractedIdFields fields = new ExtractedIdFields(
                ExtractedField.of("ANNA ERIKSSON", new BigDecimal("0.990")),
                ExtractedField.of(LocalDate.of(1974, 8, 12), new BigDecimal("0.610")),
                ExtractedField.of(LocalDate.of(2030, 4, 15), new BigDecimal("0.980")),
                "raw");

        // An average would let two crisp fields hide the illegible one, which is the opposite of
        // what someone deciding whether to trust the record needs to see.
        assertThat(IdExtractionService.weakestConfidence(fields)).isEqualByComparingTo("0.610");
    }

    @Test
    void ignoresFieldsThatWereNotRead() {
        ExtractedIdFields fields = new ExtractedIdFields(
                ExtractedField.of("ANNA ERIKSSON", new BigDecimal("0.940")),
                ExtractedField.empty(),
                ExtractedField.empty(),
                "raw");

        assertThat(IdExtractionService.weakestConfidence(fields)).isEqualByComparingTo("0.940");
    }

    @Test
    void isNullWhenNothingWasRead() {
        assertThat(IdExtractionService.weakestConfidence(ExtractedIdFields.empty("raw"))).isNull();
    }

    @Test
    void anEmptyResultKnowsItIsEmpty() {
        assertThat(ExtractedIdFields.empty("raw").isEmpty()).isTrue();
        assertThat(new ExtractedIdFields(
                ExtractedField.of("X", BigDecimal.ONE),
                ExtractedField.empty(), ExtractedField.empty(), "raw").isEmpty()).isFalse();
    }

    @Test
    void aNullValueNeverCarriesConfidence() {
        // Guards the invariant the UI relies on: no value means no confidence to display.
        assertThat(ExtractedField.of(null, new BigDecimal("0.99")).confidence()).isNull();
        assertThat(ExtractedField.fromPercent(null, 99.0f).isPresent()).isFalse();
    }

    @Test
    void textractPercentagesBecomeUnitScale() {
        // The ocr_confidence column is NUMERIC(4,3); Textract reports 0-100.
        assertThat(ExtractedField.fromPercent("X", 94.25f).confidence()).isEqualByComparingTo("0.943");
    }
}
