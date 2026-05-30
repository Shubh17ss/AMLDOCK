package nz.amldock.email;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
public class EmailConfig {

    @Bean
    public EmailService emailService(
            @Value("${amldock.mail.enabled}") boolean enabled,
            @Value("${amldock.mail.from}") String fromAddress,
            @Value("${amldock.mail.from-name}") String fromName,
            @Value("${amldock.mail.reply-to:}") String replyTo,
            ObjectProvider<JavaMailSender> sender) {
        JavaMailSender mailSender = sender.getIfAvailable();
        if (!enabled || mailSender == null) {
            return new LoggingEmailService();
        }
        return new SmtpEmailService(mailSender, fromAddress, fromName, replyTo);
    }
}
