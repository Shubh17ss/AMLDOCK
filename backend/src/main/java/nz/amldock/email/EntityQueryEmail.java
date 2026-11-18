package nz.amldock.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Tells a ROOT user that a reporting entity has asked for a change to details only ROOT may
 * edit. One message per recipient, each pointing at Workspace › Queries.
 */
@Component
public class EntityQueryEmail {

    private final String appBaseUrl;

    public EntityQueryEmail(@Value("${APP_BASE_URL:http://localhost:5173}") String appBaseUrl) {
        this.appBaseUrl = appBaseUrl.endsWith("/")
                ? appBaseUrl.substring(0, appBaseUrl.length() - 1)
                : appBaseUrl;
    }

    public EmailMessage render(String recipientEmail, String firmName,
                               String raisedByName, String raisedByEmail, String message) {
        String queriesUrl = appBaseUrl + "/workspace/queries";
        String raisedBy = raisedByName == null || raisedByName.isBlank()
                ? raisedByEmail
                : raisedByName + " (" + raisedByEmail + ")";
        String subject = "New change request from " + firmName;

        String text = """
                A change has been requested for a reporting entity.

                Reporting entity: %s
                Raised by:        %s

                %s

                Review it at: %s

                — AMLDOCK
                """.formatted(firmName, raisedBy, message, queriesUrl);

        String body = EmailLayout.paragraph("A change has been requested for a reporting entity.")
                + EmailLayout.paragraph("<strong>Reporting entity:</strong> " + EmailLayout.escape(firmName)
                        + "<br><strong>Raised by:</strong> " + EmailLayout.escape(raisedBy))
                + EmailLayout.paragraph(EmailLayout.escape(message).replace("\n", "<br>"))
                + EmailLayout.button(queriesUrl, "Open Queries");
        String html = EmailLayout.page(EmailLayout.logoUrl(appBaseUrl), "New change request", body);

        return EmailMessage.of(recipientEmail, subject, html, text);
    }
}
