package nz.amldock.email.ses;

import nz.amldock.email.EmailTemplateStore;
import nz.amldock.notification.DealNotificationEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.AlreadyExistsException;
import software.amazon.awssdk.services.sesv2.model.CreateEmailTemplateRequest;
import software.amazon.awssdk.services.sesv2.model.EmailTemplateContent;
import software.amazon.awssdk.services.sesv2.model.UpdateEmailTemplateRequest;

/**
 * Pushes the repo's email templates into SES on startup.
 *
 * <p>SES templates are AWS resources, and this project has no IaC. Creating them by hand in the
 * console would put the email bodies outside version control and outside code review — a real
 * regression from the Java text blocks they replace. This makes {@code resources/email-templates}
 * the source of truth and SES a cache of it.
 *
 * <p>Idempotent by construction: create, and on {@link AlreadyExistsException} update instead. Every
 * boot converges, so editing a template is an ordinary deploy rather than a console chore.
 *
 * <p>Failures are logged, never fatal. A missing {@code ses:CreateEmailTemplate} permission should
 * not stop the application serving requests, and the symptom it does cause — {@code
 * TEMPLATE_NOT_FOUND} on a send — is classified permanent by {@link SesBulkEmailSender}, so it
 * surfaces on the failed row with its reason rather than being retried forever.
 */
public class SesTemplateProvisioner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SesTemplateProvisioner.class);

    private final SesV2Client ses;
    private final EmailTemplateStore templates;

    public SesTemplateProvisioner(SesV2Client ses, EmailTemplateStore templates) {
        this.ses = ses;
        this.templates = templates;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (DealNotificationEvent event : DealNotificationEvent.values()) {
            try {
                upsert(templates.get(event.templateName()));
            } catch (Exception e) {
                log.error("Could not provision SES template {}: {}",
                        event.templateName(), e.toString());
            }
        }
    }

    private void upsert(EmailTemplateStore.EmailTemplate template) {
        EmailTemplateContent content = EmailTemplateContent.builder()
                .subject(template.subject())
                .html(template.html())
                .text(template.text())
                .build();
        try {
            ses.createEmailTemplate(CreateEmailTemplateRequest.builder()
                    .templateName(template.name())
                    .templateContent(content)
                    .build());
            log.info("Created SES email template {}", template.name());
        } catch (AlreadyExistsException e) {
            ses.updateEmailTemplate(UpdateEmailTemplateRequest.builder()
                    .templateName(template.name())
                    .templateContent(content)
                    .build());
            log.info("Updated SES email template {}", template.name());
        }
    }
}
