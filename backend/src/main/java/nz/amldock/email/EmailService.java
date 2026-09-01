package nz.amldock.email;

import java.util.concurrent.CompletableFuture;

/**
 * Outbound email gateway for a single rendered message. Implementations:
 *   - {@link nz.amldock.email.ses.SesEmailService}  the SES API, used when the transport is ses
 *   - {@link SmtpEmailService}     real SMTP via JavaMailSender, and what Mailpit receives in dev
 *   - {@link LoggingEmailService}  no-op fallback that logs the rendered email
 *
 * Which one is wired is decided by {@code EmailConfig.emailService}: {@code amldock.mail.enabled}
 * is the master switch, and {@code amldock.notifications.transport} (ses | smtp | log) then chooses
 * the route — the same property the bulk sender follows, so all outbound mail leaves one way.
 *
 * Sends are fire-and-forget from the caller's perspective. Failures are swallowed and logged so a
 * mail outage doesn't break user-facing flows like onboarding — or, in the case of the login code,
 * lock everybody out.
 */
public interface EmailService {

    /**
     * Send the message asynchronously. The returned future completes once delivery to the
     * SMTP server has succeeded or failed; most callers ignore it.
     */
    CompletableFuture<Boolean> send(EmailMessage message);
}
