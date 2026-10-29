package nz.amldock.audit;

import nz.amldock.common.config.TrustedProxyConfigProbe;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Item 11. The audit IP is the address the server established, never the caller's own
 * X-Forwarded-For, and it always fits audit_log.ip_address (VARCHAR(45)).
 */
class AuditIpTest {

    @Test
    void aSpoofedForwardedForHeaderIsIgnored() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("198.51.100.7");
        req.addHeader("X-Forwarded-For", "203.0.113.9, 10.0.0.1");

        assertThat(AuditService.resolveIp(req)).isEqualTo("198.51.100.7");
    }

    /** Over 45 characters used to make the INSERT fail, so the failed-login row was lost. */
    @Test
    void anOverlongAddressIsCutToTheColumnWidth() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("x".repeat(60));

        assertThat(AuditService.resolveIp(req)).hasSize(AuditService.MAX_IP_LENGTH);
    }

    @Test
    void noProxyIsTrustedUnlessConfigured() {
        assertThat(TrustedProxyConfigProbe.valveFor("")).isNull();
        assertThat(TrustedProxyConfigProbe.valveFor(null)).isNull();
    }

    @Test
    void aConfiguredProxyListInstallsTheValve() {
        var valve = TrustedProxyConfigProbe.valveFor("10[.]0[.][0-9]{1,3}[.][0-9]{1,3}");
        assertThat(valve).isNotNull();
        assertThat(valve.getRemoteIpHeader()).isEqualTo("X-Forwarded-For");
        assertThat(valve.getInternalProxies()).isEqualTo("10[.]0[.][0-9]{1,3}[.][0-9]{1,3}");
    }
}
