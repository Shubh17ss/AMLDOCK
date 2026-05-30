package nz.amldock.email;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;

public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final JavaMailSender sender;
    private final String fromAddress;
    private final String fromName;
    private final String replyTo;

    public SmtpEmailService(JavaMailSender sender,
                            @Value("${amldock.mail.from}") String fromAddress,
                            @Value("${amldock.mail.from-name}") String fromName,
                            @Value("${amldock.mail.reply-to:}") String replyTo) {
        this.sender = sender;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.replyTo = replyTo;
    }

    @Override
    @Async
    public CompletableFuture<Boolean> send(EmailMessage message) {
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            helper.setTo(message.to());
            helper.setSubject(message.subject());
            helper.setFrom(new InternetAddress(fromAddress, fromName, StandardCharsets.UTF_8.name()));
            if (replyTo != null && !replyTo.isBlank()) {
                helper.setReplyTo(replyTo);
            }
            // Plain text + HTML multipart alternative
            helper.setText(
                    message.textBody() == null ? "" : message.textBody(),
                    message.htmlBody() == null ? "" : message.htmlBody()
            );
            sender.send(mime);
            log.debug("Sent email to={} subject={}", message.to(), message.subject());
            return CompletableFuture.completedFuture(true);
        } catch (Exception e) {
            log.error("Failed to send email to={} subject={}: {}", message.to(), message.subject(), e.getMessage(), e);
            return CompletableFuture.completedFuture(false);
        }
    }
}
