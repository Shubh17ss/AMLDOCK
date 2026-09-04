package nz.amldock.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tells an address that it is no longer the one signing in.
 *
 * <p>This is the only message an account's <em>former</em> owner ever receives, and it is the point
 * of the whole thing. Email is the credential here: whoever controls the address controls the
 * account. So a change of address is a change of credential, and if it was not the owner who made
 * it, this notice is the one signal that reaches somebody who would know. Everything else about the
 * change — the confirmation code, the new session — goes to the party who made it.
 *
 * <p>Sent on both paths: the verified self-service change, and the administrative correction a firm
 * manager can make without verification.
 *
 * <p>The new address is <strong>masked</strong>. The recipient no longer holds this account and does
 * not need to be told a third party's full address, but they do need enough to tell "I did this
 * from my other mailbox" apart from "I have been locked out" — and to quote it when they report it.
 */
@Component
public class EmailChangeNotice {

    private static final Logger log = LoggerFactory.getLogger(EmailChangeNotice.class);
    private static final String SUBJECT = "Your AML_DOCK sign-in email has been changed";

    private final EmailService email;

    public EmailChangeNotice(EmailService email) {
        this.email = email;
    }

    /**
     * Fire-and-forget, like {@code UserOnboarding}: a mail outage must not roll back a change that
     * has already been committed, and must not leave the caller holding a half-applied one.
     */
    public void notifyPreviousAddress(String previousEmail, String fullName, String newEmail) {
        if (previousEmail == null || previousEmail.isBlank()) return;
        email.send(render(previousEmail, fullName, newEmail))
                .whenComplete((sent, ex) -> {
                    if (ex != null || !Boolean.TRUE.equals(sent)) {
                        log.warn("Could not notify {} that their sign-in email changed", previousEmail);
                    }
                });
    }

    EmailMessage render(String previousEmail, String fullName, String newEmail) {
        String masked = mask(newEmail);
        String text = """
                Hi %s,

                The email address used to sign in to your AML_DOCK account has been changed to %s.

                You are receiving this at your previous address because it is no longer the one
                attached to the account.

                If you made this change, nothing further is needed. If you did not, contact your
                administrator immediately — whoever holds the new address can now sign in as you.

                — AML_DOCK
                """.formatted(fullName == null ? "there" : fullName, masked);

        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 480px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">Your sign-in email has changed</h2>
                  <p>Hi %s,</p>
                  <p>The email address used to sign in to your AML_DOCK account has been changed to
                     <strong>%s</strong>.</p>
                  <p style="color:#6b7280; font-size: 13px;">You are receiving this at your previous address because it is no longer the one attached to the account.</p>
                  <p>If you made this change, nothing further is needed. If you did not,
                     <strong>contact your administrator immediately</strong> — whoever holds the new
                     address can now sign in as you.</p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AML_DOCK</p>
                </body></html>
                """.formatted(escape(fullName == null ? "there" : fullName), escape(masked));

        return EmailMessage.of(previousEmail, SUBJECT, html, text);
    }

    /**
     * {@code jane.doe@example.com} becomes {@code j******e@example.com}.
     *
     * <p>The domain stays whole — that is what tells a reader whether the account went somewhere
     * plausible or somewhere it should not have. Short local parts are masked entirely rather than
     * padded out to a fixed width, which would leak nothing but suggest a length that is wrong.
     */
    static String mask(String address) {
        if (address == null || address.isBlank()) return "a new address";
        int at = address.indexOf('@');
        if (at < 1) return "a new address";
        String local = address.substring(0, at);
        String domain = address.substring(at);
        if (local.length() <= 2) return "*".repeat(local.length()) + domain;
        return local.charAt(0) + "*".repeat(local.length() - 2) + local.charAt(local.length() - 1) + domain;
    }

    /** Mirrors the escaping in {@link WelcomeEmail}, kept local for the reason stated there. */
    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
