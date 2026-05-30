package nz.amldock.email;

/**
 * Carrier for a single outbound email. Subject + HTML body are required;
 * plain-text body is optional but recommended (multipart/alternative).
 */
public record EmailMessage(
        String to,
        String subject,
        String htmlBody,
        String textBody
) {
    public static EmailMessage of(String to, String subject, String html, String text) {
        return new EmailMessage(to, subject, html, text);
    }
}
