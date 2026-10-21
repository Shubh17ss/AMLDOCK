package nz.amldock.training;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.TrainingAssignmentEmail;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * NV-11. A session's link is rendered as an href for other people, so only http(s) is stored,
 * and a row saved before the rule is never linked in the email.
 */
class TrainingLinksTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "javascript:alert(document.domain)",
            "JavaScript:alert(1)",
            " javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
            "file:///etc/passwd",
            "//evil.example/x",
            "not a url",
            "https://"})
    void anythingButAnHttpUrlIsRefused(String url) {
        assertThatThrownBy(() -> TrainingLinks.requireHttpUrlOrNull(url))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void httpAndHttpsUrlsAreKeptTrimmed() {
        assertThat(TrainingLinks.requireHttpUrlOrNull("  https://learn.example.nz/course?id=1 "))
                .isEqualTo("https://learn.example.nz/course?id=1");
        assertThat(TrainingLinks.requireHttpUrlOrNull("HTTP://zoom.example/j/123"))
                .isEqualTo("HTTP://zoom.example/j/123");
    }

    @Test
    void blankClearsTheLink() {
        assertThat(TrainingLinks.requireHttpUrlOrNull("")).isNull();
        assertThat(TrainingLinks.requireHttpUrlOrNull("   ")).isNull();
        assertThat(TrainingLinks.requireHttpUrlOrNull(null)).isNull();
    }

    @Test
    void theAssignmentEmailLeavesOutALegacyNonHttpLink() {
        TrainingSession s = session("javascript:alert(1)");

        EmailMessage m = new TrainingAssignmentEmail("http://localhost:5173").renderSession(
                "agent@firm.nz", "An Agent", s, "Provider");

        assertThat(m.htmlBody()).doesNotContain("javascript:");
        assertThat(m.textBody()).doesNotContain("javascript:");
    }

    @Test
    void theAssignmentEmailLinksAnHttpsLink() {
        EmailMessage m = new TrainingAssignmentEmail("http://localhost:5173").renderSession(
                "agent@firm.nz", "An Agent", session("https://learn.example.nz/c"), "Provider");

        assertThat(m.htmlBody()).contains("href=\"https://learn.example.nz/c\"");
    }

    private static TrainingSession session(String url) {
        TrainingSession s = new TrainingSession();
        s.setName("AML refresher");
        s.setLocation("Online");
        s.setUrl(url);
        s.setSessionDate(LocalDate.of(2026, 11, 2));
        s.setTotalMinutes(60);
        return s;
    }
}
