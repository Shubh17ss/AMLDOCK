package nz.amldock.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;

import java.util.concurrent.CompletableFuture;

/**
 * Used when amldock.mail.enabled=false (or no transport is available). Logs that an email would
 * have gone out, and to whom.
 *
 * <p>The body is not logged unless MAIL_LOG_BODIES=true. Bodies carry sign-in codes and links, so
 * on a server with mail off, anyone who could read the logs could sign in as any user. Local dev
 * reads mail in Mailpit and does not need them; turn the flag on only on your own machine.
 */
public class LoggingEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailService.class);

    private final boolean logBodies;

    public LoggingEmailService() {
        this(false);
    }

    public LoggingEmailService(boolean logBodies) {
        this.logBodies = logBodies;
    }

    @Override
    @Async
    public CompletableFuture<Boolean> send(EmailMessage message) {
        if (!logBodies) {
            log.info("[EMAIL DISABLED] Not sent to {}: {} (body not logged; set MAIL_LOG_BODIES=true locally to see it)",
                    message.to(), message.subject());
            return CompletableFuture.completedFuture(true);
        }
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

    boolean logsBodies() { return logBodies; }
}
