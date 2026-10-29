package nz.amldock.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/** F5: per-IP throttle on the public sign-in endpoints. */
class LoginRateLimitFilterTest {

    private final LoginRateLimitFilter filter = new LoginRateLimitFilter(20);

    private MockHttpServletResponse send(String method, String path, String ip) throws Exception {
        var req = new MockHttpServletRequest(method, path);
        req.setServletPath(path);
        req.setRemoteAddr(ip);
        var res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        return res;
    }

    @Test
    void the21stSignInRequestFromOneIpInAMinuteIs429() throws Exception {
        for (int i = 0; i < 20; i++) {
            assertThat(send("POST", "/api/auth/otp/request", "10.0.0.1").getStatus()).isEqualTo(200);
        }
        var res = send("POST", "/api/auth/otp/request", "10.0.0.1");
        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getContentAsString()).contains("\"status\":429").contains("Too many sign-in attempts");
    }

    @Test
    void allFourSignInEndpointsShareOneBudget() throws Exception {
        for (int i = 0; i < 5; i++) {
            for (String p : LoginRateLimitFilter.LIMITED_PATHS) send("POST", p, "10.0.0.2");
        }
        assertThat(send("POST", "/api/auth/admin/verify", "10.0.0.2").getStatus()).isEqualTo(429);
    }

    @Test
    void anotherIpIsUnaffected() throws Exception {
        for (int i = 0; i < 21; i++) send("POST", "/api/auth/otp/verify", "10.0.0.3");
        assertThat(send("POST", "/api/auth/otp/verify", "10.0.0.4").getStatus()).isEqualTo(200);
    }

    @Test
    void otherRequestsAreNotCounted() throws Exception {
        for (int i = 0; i < 50; i++) {
            send("POST", "/api/auth/refresh", "10.0.0.5");
            send("GET", "/api/auth/me", "10.0.0.5");
        }
        assertThat(send("POST", "/api/auth/otp/request", "10.0.0.5").getStatus()).isEqualTo(200);
    }

    @Test
    void theWindowResetsAfterAMinute() {
        long t0 = 1_000_000L;
        for (int i = 0; i < 20; i++) assertThat(filter.tryAcquire("10.0.0.6", t0)).isTrue();
        assertThat(filter.tryAcquire("10.0.0.6", t0 + 59_999)).isFalse();
        assertThat(filter.tryAcquire("10.0.0.6", t0 + 60_000)).isTrue();
    }
}
