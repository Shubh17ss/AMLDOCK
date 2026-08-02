package nz.amldock.training;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.email.TrainingAssignmentEmail;
import nz.amldock.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Supplier;

/**
 * Emails staff when training lands on them, following {@link nz.amldock.user.UserOnboarding}.
 *
 * Fire-and-forget: a slow or missing SMTP must never break saving a session or course, so every
 * recipient is wrapped individually and nothing propagates. One bad address doesn't stop the
 * rest of the roster being told.
 *
 * Callers pass only the staff who are *newly* assigned — see the roster diff in
 * {@link TrainingSessionService} and {@link TrainingCourseService} — so editing a session never
 * re-notifies people who were already on it.
 */
@Component
public class TrainingNotifier {

    private static final Logger log = LoggerFactory.getLogger(TrainingNotifier.class);

    private final EmailService email;
    private final TrainingAssignmentEmail render;
    private final AuditService audit;

    public TrainingNotifier(EmailService email, TrainingAssignmentEmail render, AuditService audit) {
        this.email = email;
        this.render = render;
        this.audit = audit;
    }

    public void notifySessionAssigned(TrainingSession session, String providerName, List<User> recipients) {
        if (recipients == null || recipients.isEmpty()) return;
        for (User user : recipients) {
            dispatch(user, "TrainingSession", session.getId(), session.getName(),
                    () -> render.renderSession(user.getEmail(), user.getFullName(), session, providerName));
        }
    }

    public void notifyCourseAssigned(TrainingCourse course, int questionCount, List<User> recipients) {
        if (recipients == null || recipients.isEmpty()) return;
        for (User user : recipients) {
            dispatch(user, "TrainingCourse", course.getId(), course.getName(),
                    () -> render.renderCourse(user.getEmail(), user.getFullName(), course, questionCount));
        }
    }

    /**
     * Render, send, then audit the outcome against the recipient.
     *
     * The completion callback runs on the async mail thread where the security context is empty,
     * so this uses recordForUser rather than record — otherwise the audit row would have no
     * actor at all.
     */
    private void dispatch(User user, String entityType, Long entityId, String trainingName,
                          Supplier<EmailMessage> message) {
        try {
            email.send(message.get()).whenComplete((sent, ex) -> {
                try {
                    if (Boolean.TRUE.equals(sent)) {
                        audit.recordForUser(user.getId(), user.getEmail(),
                                AuditAction.TRAINING_ASSIGNMENT_EMAIL_SENT, entityType, entityId,
                                "Assignment email sent to " + user.getEmail() + " for " + trainingName);
                    } else {
                        audit.recordForUser(user.getId(), user.getEmail(),
                                AuditAction.TRAINING_ASSIGNMENT_EMAIL_FAILED, entityType, entityId,
                                "Assignment email could not be delivered to " + user.getEmail());
                    }
                } catch (Exception auditEx) {
                    log.warn("Could not write training-email audit for {}: {}",
                            user.getEmail(), auditEx.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Failed to dispatch training assignment email to {}: {}",
                    user.getEmail(), e.getMessage(), e);
            try {
                audit.recordForUser(user.getId(), user.getEmail(),
                        AuditAction.TRAINING_ASSIGNMENT_EMAIL_FAILED, entityType, entityId,
                        "Assignment email dispatch failed: " + e.getMessage());
            } catch (Exception ignored) { /* never block the save on audit */ }
        }
    }
}
