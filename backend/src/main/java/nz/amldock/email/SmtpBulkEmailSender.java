package nz.amldock.email;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Renders templates locally and sends one SMTP message per recipient. The dev transport.
 *
 * <p>Mailpit cannot receive an SES API call, and the local inbox at http://localhost:8025 is how
 * the whole team already checks mail. This keeps that working while still exercising the code that
 * matters: it returns one outcome per recipient, in order, so the dispatcher's per-entry result
 * mapping runs against real data rather than only in production.
 *
 * <p>Not a fallback for SES failures — it is chosen explicitly by
 * {@code amldock.notifications.transport=smtp}. Rendering uses the same
 * {@code resources/email-templates} files SES is provisioned from, so the bodies seen here are the
 * bodies that ship.
 *
 * <p>Sends are sequential and synchronous, unlike {@link SmtpEmailService}. The dispatcher already
 * runs off the request path on its own scheduler thread and needs the outcomes before it can mark
 * rows, so there is nothing to gain from going async here.
 */
public class SmtpBulkEmailSender implements BulkEmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpBulkEmailSender.class);

    private final JavaMailSender sender;
    private final EmailTemplateStore templates;
    private final String fromAddress;
    private final String fromName;
    private final String replyTo;

    public SmtpBulkEmailSender(JavaMailSender sender, EmailTemplateStore templates,
                               String fromAddress, String fromName, String replyTo) {
        this.sender = sender;
        this.templates = templates;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.replyTo = replyTo;
    }

    @Override
    public List<BulkSendOutcome> sendBulk(String templateName, List<BulkRecipient> recipients) {
        // Loading the template is a whole-call concern: if it is missing, no entry can succeed and
        // there is nothing per-recipient to report. Let it propagate.
        EmailTemplateStore.EmailTemplate template = templates.get(templateName);

        List<BulkSendOutcome> outcomes = new ArrayList<>(recipients.size());
        for (BulkRecipient r : recipients) {
            try {
                MimeMessage mime = sender.createMimeMessage();
                MimeMessageHelper helper =
                        new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
                helper.setTo(r.email());
                helper.setSubject(EmailTemplateStore.render(template.subject(), r.templateData()));
                helper.setFrom(new InternetAddress(
                        fromAddress, fromName, StandardCharsets.UTF_8.name()));
                if (replyTo != null && !replyTo.isBlank()) {
                    helper.setReplyTo(replyTo);
                }
                helper.setText(
                        EmailTemplateStore.render(template.text(), r.templateData()),
                        EmailTemplateStore.render(template.html(), r.templateData()));
                sender.send(mime);
                outcomes.add(BulkSendOutcome.ok(mime.getMessageID()));
            } catch (Exception e) {
                // SMTP gives us no way to tell a dead relay from a bad address, so everything is
                // reported retryable and the attempt ladder in the dispatcher does the bounding.
                // SES, the production transport, does distinguish the two.
                log.warn("SMTP bulk send failed for {}: {}", r.email(), e.toString());
                outcomes.add(BulkSendOutcome.retryableFailure(e.toString()));
            }
        }
        return outcomes;
    }
}
