package nz.amldock.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;

import java.util.concurrent.CompletableFuture;

/**
 * Used when amldock.mail.enabled=false (or SMTP isn't configured). Just logs the rendered
 * email so devs can copy-paste links during local development.
 */
public class LoggingEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailService.class);

    @Override
    @Async
    public CompletableFuture<Boolean> send(EmailMessage message) {
        log.info("""
                [EMAIL DISABLED — logging only]
                  To:      {}
                  Subject: {}
                  --- text ---
                {}
                  --- html ---
                {}
                """,
                message.to(),
                message.subject(),
                message.textBody() == null ? "(none)" : message.textBody(),
                message.htmlBody() == null ? "(none)" : message.htmlBody());
        return CompletableFuture.completedFuture(true);
    }
}
