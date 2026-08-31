package nz.amldock.email;

import java.util.List;
import java.util.Map;

/**
 * Sends one templated email to each of many recipients in a single operation.
 *
 * <p>Deliberately separate from {@link EmailService} rather than an extension of it. That
 * interface is single-recipient and takes a fully rendered body, which is the right shape for
 * onboarding, OTP and training mail and should stay that way. This one takes a template name plus
 * per-recipient substitution data, which is the shape SES {@code SendBulkEmail} needs and the only
 * shape that lets one API call carry personalised bodies.
 *
 * <p>Implementations are chosen by {@code amldock.notifications.transport}:
 * {@link nz.amldock.email.ses.SesBulkEmailSender} in production, {@link SmtpBulkEmailSender} in dev
 * so mail still lands in Mailpit, and {@link LoggingBulkEmailSender} where neither is available.
 *
 * <p>Implementations must never throw for a per-recipient problem — that belongs in the returned
 * outcome, so the dispatcher can retry one row without disturbing the rest of the batch. Throwing
 * is reserved for a whole-call failure, where every entry is equally undecided.
 */
public interface BulkEmailSender {

    /**
     * @param templateName one of {@link nz.amldock.notification.DealNotificationEvent#templateName()}
     * @param recipients   at most 50 — the SES per-call cap. Chunking is the caller's job.
     * @return one outcome per recipient, in the same order
     * @throws RuntimeException only when the whole call failed and no entry can be judged
     */
    List<BulkSendOutcome> sendBulk(String templateName, List<BulkRecipient> recipients);

    /** One addressee and the values substituted into their copy of the template. */
    record BulkRecipient(String email, Map<String, String> templateData) {}

    /**
     * What became of one entry.
     *
     * @param retryable whether another attempt could plausibly succeed. Transports that cannot
     *                  tell should say {@code true} for failures and let the attempt ladder in
     *                  {@code DealNotificationDispatchService} bound the retries.
     * @param messageId provider id for a successful send, null otherwise
     * @param error     why it failed, null on success
     */
    record BulkSendOutcome(boolean sent, boolean retryable, String messageId, String error) {

        public static BulkSendOutcome ok(String messageId) {
            return new BulkSendOutcome(true, false, messageId, null);
        }

        public static BulkSendOutcome retryableFailure(String error) {
            return new BulkSendOutcome(false, true, null, error);
        }

        public static BulkSendOutcome permanentFailure(String error) {
            return new BulkSendOutcome(false, false, null, error);
        }
    }
}
