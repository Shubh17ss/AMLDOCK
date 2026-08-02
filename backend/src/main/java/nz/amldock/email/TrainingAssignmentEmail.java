package nz.amldock.email;

import nz.amldock.training.TrainingCourse;
import nz.amldock.training.TrainingSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Tells a staff member they have been assigned AML training, and points them at it.
 *
 * Both flavours land on My Training with the right tab already selected, so a course email
 * doesn't open on Sessions. Every interpolated value is escaped — course names and descriptions
 * are free text somebody typed, and they end up inside an HTML document.
 */
@Component
public class TrainingAssignmentEmail {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final String appBaseUrl;

    public TrainingAssignmentEmail(@Value("${APP_BASE_URL:http://localhost:5173}") String appBaseUrl) {
        // Strip trailing slash so we can append paths cleanly.
        this.appBaseUrl = appBaseUrl.endsWith("/")
                ? appBaseUrl.substring(0, appBaseUrl.length() - 1)
                : appBaseUrl;
    }

    public EmailMessage renderSession(String recipientEmail, String fullName,
                                      TrainingSession session, String providerName) {
        String link = appBaseUrl + "/my-training?tab=sessions";
        String subject = "You've been assigned AML training: " + session.getName();
        String due = formatDue(session.getDueDate());
        String minutes = session.getTotalMinutes() + " minutes ("
                + session.getCertifiedMinutes() + " certified)";

        String text = """
                Hi %s,

                You've been assigned an AML training session.

                Session:  %s
                Provider: %s
                Location: %s
                Due:      %s
                Length:   %s
                %s
                Open My Training to see it and mark it complete once you've attended:
                %s

                — AML_DOCK
                """.formatted(
                fullName,
                session.getName(),
                providerName == null ? "—" : providerName,
                session.getLocation(),
                due,
                minutes,
                session.getUrl() == null ? "" : "Link:     " + session.getUrl() + "\n",
                link);

        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 520px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">You've been assigned AML training</h2>
                  <p>Hi %s,</p>
                  <p>A training session has been assigned to you.</p>

                  <table style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Session</td><td><strong>%s</strong></td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Provider</td><td>%s</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Location</td><td>%s</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Due</td><td>%s</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Length</td><td>%s</td></tr>
                    %s
                  </table>

                  <p style="margin: 20px 0;">
                    <a href="%s" style="display:inline-block; background:#1f4b7a; color:#ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">View my training</a>
                  </p>

                  <p style="color:#6b7280; font-size: 13px;">
                    Mark the session complete in My Training once you've attended.
                  </p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AML_DOCK</p>
                </body></html>
                """.formatted(
                escape(fullName),
                escape(session.getName()),
                escape(providerName == null ? "—" : providerName),
                escape(session.getLocation()),
                escape(due),
                escape(minutes),
                session.getUrl() == null ? "" : ("""
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Link</td><td><a href="%s">%s</a></td></tr>"""
                        .formatted(escape(session.getUrl()), escape(session.getUrl()))),
                link);

        return EmailMessage.of(recipientEmail, subject, html, text);
    }

    public EmailMessage renderCourse(String recipientEmail, String fullName,
                                     TrainingCourse course, int questionCount) {
        String link = appBaseUrl + "/my-training?tab=courses";
        String subject = "You've been assigned an AML course: " + course.getName();
        String due = formatDue(course.getDueDate());
        String assessment = questionCount == 0
                ? "Material only — no assessment"
                : questionCount + (questionCount == 1 ? " question" : " questions")
                        + ", pass mark " + course.getPassMarkPercent() + "%";

        String text = """
                Hi %s,

                You've been assigned an AML course to work through.

                Course:     %s
                Due:        %s
                Assessment: %s
                %s
                Open My Training to read the material and take the assessment:
                %s

                — AML_DOCK
                """.formatted(
                fullName,
                course.getName(),
                due,
                assessment,
                course.getDescription() == null ? "" : "\n" + course.getDescription() + "\n",
                link);

        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 520px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">You've been assigned an AML course</h2>
                  <p>Hi %s,</p>
                  <p>A course has been assigned to you to work through.</p>

                  <table style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Course</td><td><strong>%s</strong></td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Due</td><td>%s</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Assessment</td><td>%s</td></tr>
                  </table>
                  %s
                  <p style="margin: 20px 0;">
                    <a href="%s" style="display:inline-block; background:#1f4b7a; color:#ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">View my training</a>
                  </p>

                  <p style="color:#6b7280; font-size: 13px;">
                    The course material is available to download in My Training.
                  </p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AML_DOCK</p>
                </body></html>
                """.formatted(
                escape(fullName),
                escape(course.getName()),
                escape(due),
                escape(assessment),
                course.getDescription() == null ? "" : ("""
                  <p style="color:#374151; white-space: pre-wrap;">%s</p>"""
                        .formatted(escape(course.getDescription()))),
                link);

        return EmailMessage.of(recipientEmail, subject, html, text);
    }

    private static String formatDue(LocalDate dueDate) {
        return dueDate == null ? "No due date" : DATE.format(dueDate);
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
