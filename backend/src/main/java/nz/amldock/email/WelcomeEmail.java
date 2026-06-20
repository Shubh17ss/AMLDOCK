package nz.amldock.email;

import nz.amldock.user.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Renders the onboarding email a new user receives after they are created. Accounts are
 * passwordless — the user signs in with their email and a one-time code (OTP), so the email
 * just points them to the sign-in page rather than carrying a temporary password.
 */
@Component
public class WelcomeEmail {

    private static final String SUBJECT = "Welcome to AML_DOCK — your account is ready";

    private final String appBaseUrl;

    public WelcomeEmail(@Value("${APP_BASE_URL:http://localhost:5173}") String appBaseUrl) {
        // Strip trailing slash so we can append paths cleanly.
        this.appBaseUrl = appBaseUrl.endsWith("/")
                ? appBaseUrl.substring(0, appBaseUrl.length() - 1)
                : appBaseUrl;
    }

    public EmailMessage render(String recipientEmail, String fullName, Role role) {
        String loginUrl = appBaseUrl + "/login";
        String roleLabel = prettyRole(role);

        String text = """
                Hi %s,

                An AML_DOCK account has been created for you with the role: %s.

                Sign in at: %s
                Email:      %s

                Your account is passwordless — enter your email at sign-in and we'll send you a
                one-time code to complete login.

                If you weren't expecting this email, please contact your administrator.

                — AML_DOCK
                """.formatted(fullName, roleLabel, loginUrl, recipientEmail);

        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 520px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">Welcome to AML_DOCK</h2>
                  <p>Hi %s,</p>
                  <p>An AML_DOCK account has been created for you with the role <strong>%s</strong>.</p>

                  <table style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Email</td><td><strong>%s</strong></td></tr>
                  </table>

                  <p style="color:#374151;">Your account is passwordless. Enter your email at sign-in and
                     we'll send you a one-time code to complete login.</p>

                  <p style="margin: 20px 0;">
                    <a href="%s" style="display:inline-block; background:#1f4b7a; color:#ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Sign in</a>
                  </p>

                  <p style="color:#6b7280; font-size: 13px;">
                    If you weren't expecting this email, contact your administrator.
                  </p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AML_DOCK</p>
                </body></html>
                """.formatted(escape(fullName), escape(roleLabel), escape(recipientEmail), loginUrl);

        return EmailMessage.of(recipientEmail, SUBJECT, html, text);
    }

    private static String prettyRole(Role role) {
        return switch (role) {
            case ROOT -> "Platform Administrator";
            case AML_COMPLIANCE_OFFICER -> "AML Compliance Officer";
            case SENIOR_MANAGER -> "Senior Manager";
            case SALES_MANAGER -> "Sales Manager";
            case AGENT -> "Agent";
            case AGENT_PA -> "Agent PA";
            case ADMIN -> "Branch Admin";
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
