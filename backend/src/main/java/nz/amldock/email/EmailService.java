package nz.amldock.email;

import java.util.concurrent.CompletableFuture;

/**
 * Outbound email gateway. Implementations:
 *   - {@link SmtpEmailService}     real SMTP via JavaMailSender, used when amldock.mail.enabled=true
 *   - {@link LoggingEmailService}  no-op fallback that logs the rendered email, used in dev
 *
 * Sends are fire-and-forget from the caller's perspective. Failures are swallowed and logged
 * so a missing SMTP doesn't break user-facing flows like onboarding.
 */
public interface EmailService {

    /**
     * Send the message asynchronously. The returned future completes once delivery to the
     * SMTP server has succeeded or failed; most callers ignore it.
     */
    CompletableFuture<Boolean> send(EmailMessage message);
}
