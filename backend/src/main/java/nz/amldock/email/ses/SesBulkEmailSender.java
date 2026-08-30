package nz.amldock.email.ses;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.email.BulkEmailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.BulkEmailContent;
import software.amazon.awssdk.services.sesv2.model.BulkEmailEntry;
import software.amazon.awssdk.services.sesv2.model.BulkEmailEntryResult;
import software.amazon.awssdk.services.sesv2.model.BulkEmailStatus;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.ReplacementEmailContent;
import software.amazon.awssdk.services.sesv2.model.ReplacementTemplate;
import software.amazon.awssdk.services.sesv2.model.SendBulkEmailRequest;
import software.amazon.awssdk.services.sesv2.model.SendBulkEmailResponse;
import software.amazon.awssdk.services.sesv2.model.Template;

import java.util.ArrayList;
import java.util.List;

/**
 * Sends one SES {@code SendBulkEmail} carrying a personalised copy for each recipient.
 *
 * <p>Every {@link BulkEmailEntry} names exactly one destination. That is deliberate: a shared
 * {@code to:} would disclose the whole recipient list to everyone on it, and BCC would cost the
 * personalisation and the per-recipient result this class exists to return.
 *
 * <p><strong>The result array is positional.</strong> SES returns
 * {@code bulkEmailEntryResults()} in request order, and that ordering is the only thing tying an
 * outcome back to a row. The size check below is what stops a silent misalignment turning into
 * rows marked with someone else's outcome.
 */
public class SesBulkEmailSender implements BulkEmailSender {

    private static final Logger log = LoggerFactory.getLogger(SesBulkEmailSender.class);

    /** SES rejects a call carrying more than this many entries. Chunking is the caller's job. */
    public static final int MAX_ENTRIES_PER_CALL = 50;

    private final SesV2Client ses;
    private final ObjectMapper json;
    private final String fromAddress;
    private final String fromName;
    private final String replyTo;
    private final String configurationSet;

    public SesBulkEmailSender(SesV2Client ses, ObjectMapper json, String fromAddress,
                              String fromName, String replyTo, String configurationSet) {
        this.ses = ses;
        this.json = json;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.replyTo = replyTo;
        this.configurationSet = configurationSet;
    }

    @Override
    public List<BulkSendOutcome> sendBulk(String templateName, List<BulkRecipient> recipients) {
        if (recipients.isEmpty()) return List.of();
        if (recipients.size() > MAX_ENTRIES_PER_CALL) {
            throw new IllegalArgumentException(
                    "SendBulkEmail accepts at most " + MAX_ENTRIES_PER_CALL + " entries, got "
                            + recipients.size() + " — the caller must chunk");
        }

        List<BulkEmailEntry> entries = new ArrayList<>(recipients.size());
        for (BulkRecipient r : recipients) {
            entries.add(BulkEmailEntry.builder()
                    .destination(Destination.builder().toAddresses(r.email()).build())
                    .replacementEmailContent(ReplacementEmailContent.builder()
                            .replacementTemplate(ReplacementTemplate.builder()
                                    .replacementTemplateData(toJson(r.templateData()))
                                    .build())
                            .build())
                    .build());
        }

        SendBulkEmailRequest.Builder request = SendBulkEmailRequest.builder()
                .fromEmailAddress(from())
                .defaultContent(BulkEmailContent.builder()
                        .template(Template.builder()
                                .templateName(templateName)
                                // Every variable is supplied per entry, but SES still wants a
                                // default: a template referencing a name absent from both fails
                                // the whole call rather than that one entry.
                                .templateData("{}")
                                .build())
                        .build())
                .bulkEmailEntries(entries);
        if (replyTo != null && !replyTo.isBlank()) {
            request.replyToAddresses(replyTo);
        }
        if (configurationSet != null && !configurationSet.isBlank()) {
            request.configurationSetName(configurationSet);
        }

        // Not caught. A whole-call failure leaves every entry equally undecided, and the caller
        // marks the batch retryable — which is the right answer for credentials, throttling at the
        // account level, and network trouble alike.
        SendBulkEmailResponse response = ses.sendBulkEmail(request.build());

        List<BulkEmailEntryResult> results = response.bulkEmailEntryResults();
        if (results == null || results.size() != recipients.size()) {
            throw new IllegalStateException(
                    "SES returned " + (results == null ? "no" : String.valueOf(results.size()))
                            + " results for " + recipients.size() + " entries — cannot map outcomes");
        }

        List<BulkSendOutcome> outcomes = new ArrayList<>(results.size());
        for (int i = 0; i < results.size(); i++) {
            outcomes.add(toOutcome(results.get(i), recipients.get(i).email()));
        }
        return outcomes;
    }

    private BulkSendOutcome toOutcome(BulkEmailEntryResult result, String email) {
        BulkEmailStatus status = result.status();
        if (status == BulkEmailStatus.SUCCESS) {
            return BulkSendOutcome.ok(result.messageId());
        }
        String reason = status + (result.error() == null ? "" : ": " + result.error());
        if (isRetryable(status)) {
            log.warn("SES entry for {} failed, will retry: {}", email, reason);
            return BulkSendOutcome.retryableFailure(reason);
        }
        log.warn("SES entry for {} failed permanently: {}", email, reason);
        return BulkSendOutcome.permanentFailure(reason);
    }

    /**
     * Whether another attempt could plausibly succeed.
     *
     * <p>This is the distinction SMTP could not give us — {@code SmtpEmailService} collapses every
     * failure to a bare {@code false} — and it is the strongest practical argument for sending
     * through SES. Throttling and account-level pauses clear on their own; a rejected message or a
     * missing template will not, and retrying it only burns quota.
     *
     * <p>Anything unrecognised is treated as permanent, so a new SES status surfaces as one visible
     * failure rather than four attempts at the same doomed send. Same stance as
     * {@code IdExtractionService.isRetryable}.
     */
    public static boolean isRetryable(BulkEmailStatus status) {
        return switch (status) {
            case TRANSIENT_FAILURE,
                 ACCOUNT_THROTTLED,
                 ACCOUNT_DAILY_QUOTA_EXCEEDED,
                 ACCOUNT_SENDING_PAUSED,
                 CONFIGURATION_SET_SENDING_PAUSED -> true;
            default -> false;
        };
    }

    private String from() {
        if (fromName == null || fromName.isBlank()) return fromAddress;
        return fromName + " <" + fromAddress + ">";
    }

    private String toJson(java.util.Map<String, String> data) {
        try {
            return json.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise SES template data", e);
        }
    }
}
