package nz.amldock.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Logs what would have been sent and reports success. The transport of last resort, for runs with
 * neither SES credentials nor an SMTP sink.
 *
 * <p>Mirrors {@link LoggingEmailService}: reporting success means outbox rows settle as SENT and
 * the queue drains, which is what you want locally — a queue that only ever backs up teaches you
 * nothing about the rest of the pipeline.
 */
public class LoggingBulkEmailSender implements BulkEmailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingBulkEmailSender.class);

    private final EmailTemplateStore templates;

    public LoggingBulkEmailSender(EmailTemplateStore templates) {
        this.templates = templates;
    }

    @Override
    public List<BulkSendOutcome> sendBulk(String templateName, List<BulkRecipient> recipients) {
        EmailTemplateStore.EmailTemplate template = templates.get(templateName);
        List<BulkSendOutcome> outcomes = new ArrayList<>(recipients.size());
        for (BulkRecipient r : recipients) {
            log.info("""
                    [BULK EMAIL DISABLED — logging only]
                      Template: {}
                      To:       {}
                      Subject:  {}
                      --- text ---
                    {}
                    """,
                    templateName,
                    r.email(),
                    EmailTemplateStore.render(template.subject(), r.templateData()),
                    EmailTemplateStore.render(template.text(), r.templateData()));
            outcomes.add(BulkSendOutcome.ok(null));
        }
        return outcomes;
    }
}
