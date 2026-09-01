package nz.amldock.email.ses;

import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.SendEmailResponse;

import java.util.concurrent.CompletableFuture;

/**
 * Sends one already-rendered message through the SES API.
 *
 * <p>The counterpart to {@link SesBulkEmailSender}, and deliberately not built on it. That one
 * names a template SES holds and personalises it per recipient, which is what a hundred deal
 * notifications want. These callers — the login code, the welcome email, a training assignment —
 * arrive with their subject and body already rendered in Java and go to exactly one person, so the
 * templated API would mean provisioning a template for content the caller has already produced.
 *
 * <p>Both parts of the body are sent when both are present, the same multipart/alternative pair
 * {@code SmtpEmailService} builds: a client that will not render HTML still has something to show.
 *
 * <p><strong>Failures are logged, never thrown.</strong> {@link EmailService} says sends are
 * fire-and-forget, and the login OTP is the reason it matters — an exception here would turn an SES
 * outage or an unverified sender into nobody being able to sign in at all.
 */
public class SesEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SesEmailService.class);

    private final SesV2Client ses;
    private final String fromAddress;
    private final String fromName;
    private final String replyTo;
    private final String configurationSet;

    public SesEmailService(SesV2Client ses, String fromAddress, String fromName,
                           String replyTo, String configurationSet) {
        this.ses = ses;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.replyTo = replyTo;
        this.configurationSet = configurationSet;
    }

    @Override
    @Async
    public CompletableFuture<Boolean> send(EmailMessage message) {
        try {
            Body.Builder body = Body.builder();
            if (message.htmlBody() != null && !message.htmlBody().isBlank()) {
                body.html(utf8(message.htmlBody()));
            }
            if (message.textBody() != null && !message.textBody().isBlank()) {
                body.text(utf8(message.textBody()));
            }

            SendEmailRequest.Builder request = SendEmailRequest.builder()
                    .fromEmailAddress(from())
                    .destination(Destination.builder().toAddresses(message.to()).build())
                    .content(EmailContent.builder()
                            .simple(Message.builder()
                                    .subject(utf8(message.subject()))
                                    .body(body.build())
                                    .build())
                            .build());
            if (replyTo != null && !replyTo.isBlank()) {
                request.replyToAddresses(replyTo);
            }
            if (configurationSet != null && !configurationSet.isBlank()) {
                request.configurationSetName(configurationSet);
            }

            SendEmailResponse response = ses.sendEmail(request.build());
            log.debug("Sent email via SES to={} subject={} messageId={}",
                    message.to(), message.subject(), response.messageId());
            return CompletableFuture.completedFuture(true);
        } catch (Exception e) {
            // Logged at error with the cause: an unverified From address and a sandbox-blocked
            // recipient both land here, and both are answered by the message SES returns.
            log.error("Failed to send email via SES to={} subject={}: {}",
                    message.to(), message.subject(), e.getMessage(), e);
            return CompletableFuture.completedFuture(false);
        }
    }

    /** SES wants the charset named explicitly; everything this app renders is UTF-8. */
    private static Content utf8(String data) {
        return Content.builder().data(data == null ? "" : data).charset("UTF-8").build();
    }

    /** Same shape as {@link SesBulkEmailSender}: a bare address unless a display name is set. */
    private String from() {
        if (fromName == null || fromName.isBlank()) return fromAddress;
        return fromName + " <" + fromAddress + ">";
    }
}
