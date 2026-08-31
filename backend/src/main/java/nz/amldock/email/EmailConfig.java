package nz.amldock.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.email.ses.SesBulkEmailSender;
import nz.amldock.email.ses.SesTemplateProvisioner;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.EnableAsync;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;

@Configuration
@EnableAsync
public class EmailConfig {

    // Binds the canonical amldock.mail.* properties (application.yml), which themselves resolve
    // from MAIL_ENABLED / MAIL_FROM / MAIL_FROM_NAME / MAIL_REPLY_TO with a fallback.
    //
    // These used to read the bare env-var names, which meant a From address set in the yml was
    // never picked up and every message went out as noreply@amldock.local — fatal against SES,
    // which rejects an unverified sender. Exactly the bug StorageConfig already documents for the
    // AWS credentials; same shape, same fix. Reading the property rather than the variable keeps
    // both routes working, because the property is defined in terms of the variable.

    @Bean
    public EmailService emailService(
            @Value("${amldock.mail.enabled:false}") boolean enabled,
            @Value("${amldock.mail.from:noreply@amldock.local}") String fromAddress,
            @Value("${amldock.mail.from-name:AML_DOCK}") String fromName,
            @Value("${amldock.mail.reply-to:}") String replyTo,
            ObjectProvider<JavaMailSender> sender) {
        JavaMailSender mailSender = sender.getIfAvailable();
        if (!enabled || mailSender == null) {
            return new LoggingEmailService();
        }
        return new SmtpEmailService(mailSender, fromAddress, fromName, replyTo);
    }

    /**
     * The SES client, built only when SES is the chosen transport.
     *
     * <p>Reuses the {@code AwsCredentialsProvider} bean from
     * {@link nz.amldock.document.storage.StorageConfig} and the same {@code amldock.s3.region},
     * exactly as {@link nz.amldock.document.ocr.TextractConfig} does — one place to change
     * credentials, and no second copy of the region to drift.
     */
    @Bean
    @ConditionalOnProperty(name = "amldock.notifications.transport", havingValue = "ses",
                           matchIfMissing = true)
    public SesV2Client sesV2Client(AwsCredentialsProvider credentials,
                                   @Value("${amldock.s3.region:ap-southeast-2}") String region) {
        return SesV2Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .build();
    }

    /**
     * Chooses how bulk deal notifications leave the box.
     *
     * <p>Three transports rather than two, because the dev story matters: Mailpit cannot receive an
     * SES API call, and losing the local inbox would cost more than the extra implementation. All
     * three render from the same {@code resources/email-templates} files, so what a developer sees
     * in Mailpit is what ships.
     *
     * <ul>
     *   <li>{@code ses}  — production. Personalised entries in one API call, per-entry statuses.
     *   <li>{@code smtp} — dev. One message per recipient to Mailpit, same per-entry outcomes.
     *   <li>{@code log}  — neither available. Logs and reports success so the queue still drains.
     * </ul>
     *
     * <p>An unset or unknown value falls back to logging rather than failing startup: a
     * misconfigured transport should cost notifications, not the whole application.
     */
    @Bean
    public BulkEmailSender bulkEmailSender(
            @Value("${amldock.notifications.transport:ses}") String transport,
            @Value("${amldock.mail.from:noreply@amldock.local}") String fromAddress,
            @Value("${amldock.mail.from-name:AML_DOCK}") String fromName,
            @Value("${amldock.mail.reply-to:}") String replyTo,
            @Value("${amldock.notifications.configuration-set:}") String configurationSet,
            EmailTemplateStore templates,
            ObjectMapper json,
            ObjectProvider<SesV2Client> ses,
            ObjectProvider<JavaMailSender> mail) {

        if ("ses".equalsIgnoreCase(transport)) {
            SesV2Client client = ses.getIfAvailable();
            if (client != null) {
                return new SesBulkEmailSender(
                        client, json, fromAddress, fromName, replyTo, configurationSet);
            }
            return new LoggingBulkEmailSender(templates);
        }

        if ("smtp".equalsIgnoreCase(transport)) {
            JavaMailSender mailSender = mail.getIfAvailable();
            if (mailSender != null) {
                return new SmtpBulkEmailSender(
                        mailSender, templates, fromAddress, fromName, replyTo);
            }
        }

        return new LoggingBulkEmailSender(templates);
    }

    /**
     * Keeps SES templates in step with the repo. Only when SES is actually the transport — there is
     * nothing to provision otherwise, and a dev machine should not need SES permissions to boot.
     */
    @Bean
    @ConditionalOnProperty(name = "amldock.notifications.provision-templates",
                           havingValue = "true", matchIfMissing = true)
    public ApplicationRunner sesTemplateProvisioner(
            @Value("${amldock.notifications.transport:ses}") String transport,
            EmailTemplateStore templates,
            ObjectProvider<SesV2Client> ses) {
        SesV2Client client = "ses".equalsIgnoreCase(transport) ? ses.getIfAvailable() : null;
        if (client == null) {
            return args -> { /* not sending through SES; nothing to provision */ };
        }
        return new SesTemplateProvisioner(client, templates);
    }
}
