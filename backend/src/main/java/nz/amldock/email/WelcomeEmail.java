package nz.amldock.email;

import nz.amldock.user.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Renders the onboarding email a new user receives after admin creates their account.
 * The email contains the admin-set temporary password and a deep-link to the profile page
 * so they can change it on first login.
 */
@Component
public class WelcomeEmail {

    private static final String SUBJECT = "Welcome to AML_DOCK — your account is ready";

    private final String appBaseUrl;

    public WelcomeEmail(@Value("${amldock.mail.app-base-url}") String appBaseUrl) {
        // Strip trailing slash so we can append paths cleanly.
        this.appBaseUrl = appBaseUrl.endsWith("/")
                ? appBaseUrl.substring(0, appBaseUrl.length() - 1)
                : appBaseUrl;
    }

    public EmailMessage render(String recipientEmail, String fullName, Role role, String tempPassword) {
        String loginUrl = appBaseUrl + "/login";
        String profileUrl = appBaseUrl + "/profile";
        String roleLabel = prettyRole(role);

        String text = """
                Hi %s,

                An AML_DOCK account has been created for you with the role: %s.

                Sign in at: %s
                Email:      %s
                Temporary password: %s

                For your security, please change your password on first login:
                  %s

                If you weren't expecting this email, please contact your administrator.

                — AML_DOCK
                """.formatted(fullName, roleLabel, loginUrl, recipientEmail, tempPassword, profileUrl);

        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 520px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">Welcome to AML_DOCK</h2>
                  <p>Hi %s,</p>
                  <p>An AML_DOCK account has been created for you with the role <strong>%s</strong>.</p>

                  <table style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Email</td><td><strong>%s</strong></td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Temporary password</td>
                        <td><code style="background:#f3f4f6; padding: 2px 6px; border-radius:4px;">%s</code></td></tr>
                  </table>

                  <p style="margin: 20px 0;">
                    <a href="%s" style="display:inline-block; background:#1f4b7a; color:#ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Sign in</a>
                    &nbsp;
                    <a href="%s" style="display:inline-block; background:#ffffff; color:#1f4b7a; padding: 10px 18px; border-radius: 6px; text-decoration: none; border:1px solid #1f4b7a;">Change password</a>
                  </p>

                  <p style="color:#6b7280; font-size: 13px;">
                    For your security, please change your temporary password on first login.
                    If you weren't expecting this email, contact your administrator.
                  </p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AML_DOCK</p>
                </body></html>
                """.formatted(escape(fullName), escape(roleLabel), escape(recipientEmail),
                        escape(tempPassword), loginUrl, profileUrl);

        return EmailMessage.of(recipientEmail, SUBJECT, html, text);
    }

    private static String prettyRole(Role role) {
        return switch (role) {
            case BROKER -> "Broker";
            case COMPLIANCE -> "Compliance Officer";
            case MANAGER -> "Manager / Admin";
            case FIRM_USER -> "Real-Estate Firm User";
        };
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
