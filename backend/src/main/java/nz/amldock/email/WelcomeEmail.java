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

    private static final String SUBJECT = "Welcome to AMLDOCK — your account is ready";

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

                An AMLDOCK account has been created for you with the role: %s.

                Sign in at: %s
                Email:      %s

                Your account is passwordless — enter your email at sign-in and we'll send you a
                one-time code to complete login.

                If you weren't expecting this email, please contact your administrator.

                — AMLDOCK
                """.formatted(fullName, roleLabel, loginUrl, recipientEmail);

        String body = EmailLayout.paragraph("Hi " + escape(fullName) + ",")
                + EmailLayout.paragraph("An AMLDOCK account has been created for you as <strong>"
                        + escape(roleLabel) + "</strong>.")
                + EmailLayout.paragraph("Sign in with <strong>" + escape(recipientEmail) + "</strong>.")
                + EmailLayout.paragraph("Your account is passwordless: enter your email at sign-in and we'll"
                        + " send you a one-time code to complete login.")
                + EmailLayout.button(loginUrl, "Sign in")
                + EmailLayout.finePrint("If you weren't expecting this email, contact your administrator.");
        String html = EmailLayout.page(EmailLayout.logoUrl(appBaseUrl), "Welcome to AMLDOCK", body);

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
            case AUDIT -> "Auditor";
            case FINANCE -> "Finance";
        };
    }

    private static String escape(String s) {
        return EmailLayout.escape(s);
    }
}
