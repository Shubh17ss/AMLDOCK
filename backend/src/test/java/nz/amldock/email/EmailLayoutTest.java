package nz.amldock.email;

import nz.amldock.user.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The shared account-email look: logo, brand colours, centred, and user text escaped. */
class EmailLayoutTest {

    @Test
    void theLogoIsServedByTheAppWhateverTheBaseUrlEndsWith() {
        assertThat(EmailLayout.logoUrl("https://app.amldock.nz/"))
                .isEqualTo("https://app.amldock.nz/email/amldock-logo.png");
        assertThat(EmailLayout.logoUrl("https://app.amldock.nz"))
                .isEqualTo("https://app.amldock.nz/email/amldock-logo.png");
    }

    @Test
    void theWelcomeEmailCarriesTheLogoBrandColoursAndCentredText() {
        String html = new WelcomeEmail("https://app.amldock.nz")
                .render("jane@firm.nz", "Jane <b>Smith</b>", Role.AGENT).htmlBody();

        assertThat(html).contains("src=\"https://app.amldock.nz/email/amldock-logo.png\"");
        assertThat(html).contains("alt=\"AMLDOCK\"");
        assertThat(html).contains(EmailLayout.BLUE).contains(EmailLayout.INK);
        assertThat(html).contains("text-align:center");
        assertThat(html).contains("href=\"https://app.amldock.nz/login\"");
        // A name is text, never markup.
        assertThat(html).contains("Jane &lt;b&gt;Smith&lt;/b&gt;").doesNotContain("<b>Smith</b>");
    }

    @Test
    void aCodeIsShownOnItsOwnPanel() {
        assertThat(EmailLayout.code("123456")).contains("123456").contains(EmailLayout.BLUE);
    }
}
