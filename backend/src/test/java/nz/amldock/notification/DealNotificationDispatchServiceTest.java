package nz.amldock.notification;

import nz.amldock.email.ses.SesBulkEmailSender;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.sesv2.model.BulkEmailStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The two decisions the dispatcher makes that are worth pinning down without a database: whether an
 * SES status deserves another attempt, and how a claimed batch is cut up for the provider.
 */
class DealNotificationDispatchServiceTest {

    /* ---------- retry classification ---------- */

    /**
     * This is the distinction SMTP could not give us — SmtpEmailService collapses every failure to
     * a bare false — and it is the main thing sending through SES buys.
     */
    @Test
    void throttlingAndPausesAreWorthRetrying() {
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.ACCOUNT_THROTTLED)).isTrue();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.ACCOUNT_DAILY_QUOTA_EXCEEDED)).isTrue();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.ACCOUNT_SENDING_PAUSED)).isTrue();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.CONFIGURATION_SET_SENDING_PAUSED)).isTrue();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.TRANSIENT_FAILURE)).isTrue();
    }

    /**
     * A rejected message or a missing template will never succeed, and retrying only burns quota.
     * MESSAGE_REJECTED is the one that matters most in practice: it is what every unverified
     * address returns while the account is still in the SES sandbox.
     */
    @Test
    void rejectionsAndMisconfigurationAreNotWorthRetrying() {
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.MESSAGE_REJECTED)).isFalse();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.TEMPLATE_NOT_FOUND)).isFalse();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.MAIL_FROM_DOMAIN_NOT_VERIFIED)).isFalse();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.CONFIGURATION_SET_NOT_FOUND)).isFalse();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.ACCOUNT_SUSPENDED)).isFalse();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.INVALID_PARAMETER)).isFalse();
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.FAILED)).isFalse();
    }

    @Test
    void successIsNotAFailureToClassify() {
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.SUCCESS)).isFalse();
    }

    /**
     * An SES status the SDK does not know about arrives as UNKNOWN_TO_SDK_VERSION. Treating it as
     * permanent means a new status surfaces as one visible failure rather than four attempts at the
     * same doomed send — the stance IdExtractionService takes for Textract.
     */
    @Test
    void unrecognisedStatusesAreTreatedAsPermanent() {
        assertThat(SesBulkEmailSender.isRetryable(BulkEmailStatus.UNKNOWN_TO_SDK_VERSION)).isFalse();
    }

    /* ---------- chunking ---------- */

    @Test
    void aBatchWithinTheCapIsASingleChunk() {
        List<List<Integer>> chunks = DealNotificationDispatchService.chunk(range(50), 50);
        assertThat(chunks).hasSize(1);
        assertThat(chunks.get(0)).hasSize(50);
    }

    /** 50 is the SES SendBulkEmail cap; one recipient over must become a second call. */
    @Test
    void oneOverTheCapSplitsInTwo() {
        List<List<Integer>> chunks = DealNotificationDispatchService.chunk(range(51), 50);
        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(0)).hasSize(50);
        assertThat(chunks.get(1)).hasSize(1);
    }

    @Test
    void chunkingPreservesOrderAndLosesNobody() {
        List<Integer> all = range(125);
        List<List<Integer>> chunks = DealNotificationDispatchService.chunk(all, 50);

        assertThat(chunks).hasSize(3);
        assertThat(chunks.stream().flatMap(List::stream).toList())
                .as("every recipient appears exactly once, in order")
                .isEqualTo(all);
    }

    @Test
    void anEmptyBatchProducesNoCalls() {
        assertThat(DealNotificationDispatchService.chunk(List.<Integer>of(), 50)).isEmpty();
    }

    private static List<Integer> range(int n) {
        return java.util.stream.IntStream.range(0, n).boxed().toList();
    }
}
