package nz.amldock.email;

/**
 * The one look AMLDOCK's account emails share: the logo, a blue heading, ink body text, all
 * centred on a white card.
 *
 * <p>Built from tables with inline styles because that is what email clients render — Outlook
 * ignores most of CSS and Gmail drops {@code <style>} blocks. Colours are the app's own: the blue
 * is {@code --cl-blue} and the ink {@code --cl-ink} in frontend/src/styles/theme-vars.css.
 *
 * <p>The logo is linked rather than embedded: Gmail strips {@code data:} images, and inline
 * attachments would need raw MIME through every sender. It is served by the web app at
 * {@link #LOGO_PATH}; its alt text keeps the name visible where images are blocked.
 *
 * <p>Callers pass HTML they have already escaped — see {@link #escape}.
 */
public final class EmailLayout {

    public static final String BLUE = "#1B5FE3";
    public static final String INK = "#242C3C";
    private static final String PAGE_BG = "#F3F5F9";
    private static final String CODE_BG = "#EEF3FD";
    private static final String FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    /** Where the web app serves the logo (frontend/public/email). */
    public static final String LOGO_PATH = "/email/amldock-logo.png";

    private EmailLayout() {}

    /** The logo's absolute URL for a given app base URL, trailing slash or not. */
    public static String logoUrl(String appBaseUrl) {
        String base = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
        return base + LOGO_PATH;
    }

    /** A whole email: the logo, the heading and the body, centred on a card. */
    public static String page(String logoUrl, String heading, String bodyHtml) {
        return """
                <!doctype html>
                <html><body style="margin:0; padding:0; background:%s;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:%s;">
                  <tr><td align="center" style="padding:32px 16px;">
                    <table role="presentation" width="520" cellpadding="0" cellspacing="0"
                           style="max-width:520px; width:100%%; background:#ffffff; border-radius:14px;">
                      <tr><td align="center" style="padding:32px 32px 8px 32px;">
                        <img src="%s" width="160" alt="AMLDOCK"
                             style="display:block; width:160px; height:auto; border:0; margin:0 auto;">
                      </td></tr>
                      <tr><td align="center" style="padding:16px 32px 32px 32px; font-family:%s; color:%s; font-size:15px; line-height:1.55; text-align:center;">
                        <h1 style="margin:0 0 16px 0; font-size:22px; font-weight:700; color:%s;">%s</h1>
                        %s
                        <p style="margin:28px 0 0 0; font-size:12px; color:%s; opacity:0.6;">&mdash; AMLDOCK</p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
                </body></html>
                """.formatted(PAGE_BG, PAGE_BG, escape(logoUrl), FONT, INK, BLUE, heading, bodyHtml, INK);
    }

    /** A paragraph of body text. */
    public static String paragraph(String html) {
        return "<p style=\"margin:0 0 14px 0; color:" + INK + "; text-align:center;\">" + html + "</p>";
    }

    /** Smaller print — expiry notes, "if this wasn't you". */
    public static String finePrint(String html) {
        return "<p style=\"margin:18px 0 0 0; font-size:13px; color:" + INK + "; opacity:0.7; text-align:center;\">"
                + html + "</p>";
    }

    /** The one action in an email, as a blue button. */
    public static String button(String href, String label) {
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:22px auto;">
                  <tr><td align="center" style="border-radius:8px; background:%s;">
                    <a href="%s" style="display:inline-block; padding:12px 26px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">%s</a>
                  </td></tr>
                </table>
                """.formatted(BLUE, escape(href), label);
    }

    /** A one-time code: large, spaced, in blue on a light blue panel. */
    public static String code(String code) {
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:20px auto;">
                  <tr><td align="center" style="background:%s; border-radius:10px; padding:14px 26px;
                       font-family:'SFMono-Regular', Menlo, Consolas, monospace; font-size:30px; font-weight:800;
                       letter-spacing:8px; color:%s;">%s</td></tr>
                </table>
                """.formatted(CODE_BG, BLUE, escape(code));
    }

    /** HTML-escapes a value from outside the email — a name, an address, a role. */
    public static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
