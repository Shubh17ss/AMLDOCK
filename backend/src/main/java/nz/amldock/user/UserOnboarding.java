package nz.amldock.user;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.email.WelcomeEmail;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Sends the passwordless welcome email a new user receives, or — when an existing account is added
 * to another reporting entity — the note saying so. Shared by the direct user-create flow
 * (UserController) and firm onboarding (which auto-provisions a compliance officer).
 *
 * Fire-and-forget: failures are audited but never propagated, so a slow/down SMTP can't break
 * the create response.
 */
@Component
public class UserOnboarding {

    private static final Logger log = LoggerFactory.getLogger(UserOnboarding.class);

    private final EmailService email;
    private final WelcomeEmail welcomeEmail;
    private final AuditService audit;
    private final RealEstateFirmRepository firms;

    public UserOnboarding(EmailService email, WelcomeEmail welcomeEmail, AuditService audit,
                          RealEstateFirmRepository firms) {
        this.email = email;
        this.welcomeEmail = welcomeEmail;
        this.audit = audit;
        this.firms = firms;
    }

    public void sendWelcome(User user) {
        send(user, () -> welcomeEmail.render(user.getEmail(), user.getFullName(), user.getRole()));
    }

    public void sendAddedToEntity(User user, Long firmId, Role role) {
        send(user, () -> welcomeEmail.renderAddedToEntity(user.getEmail(), user.getFullName(), role,
                firms.findById(firmId).map(RealEstateFirm::getName).orElse("a new reporting entity")));
    }

    private void send(User user, java.util.function.Supplier<EmailMessage> render) {
        try {
            EmailMessage message = render.get();
            email.send(message).whenComplete((sent, ex) -> {
                try {
                    if (Boolean.TRUE.equals(sent)) {
                        audit.record(AuditAction.USER_WELCOME_EMAIL_SENT, "User", user.getId(),
                                "Welcome email sent to " + user.getEmail());
                    } else {
                        audit.record(AuditAction.USER_WELCOME_EMAIL_FAILED, "User", user.getId(),
                                "Welcome email could not be delivered to " + user.getEmail());
                    }
                } catch (Exception auditEx) {
                    log.warn("Could not write welcome-email audit for user {}: {}",
                            user.getEmail(), auditEx.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Failed to dispatch welcome email for user {}: {}", user.getEmail(), e.getMessage(), e);
            try {
                audit.record(AuditAction.USER_WELCOME_EMAIL_FAILED, "User", user.getId(),
                        "Welcome email dispatch failed: " + e.getMessage());
            } catch (Exception ignored) { /* never block create on audit */ }
        }
    }
}
