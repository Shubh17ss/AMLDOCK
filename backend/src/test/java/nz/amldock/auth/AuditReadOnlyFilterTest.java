package nz.amldock.auth;

import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F4: the AUDIT role must be refused every write, whatever the request path looks like. The filter
 * fails closed: only the decoded servlet path of refresh/logout is exempt.
 */
class AuditReadOnlyFilterTest {

    private final AuditReadOnlyFilter filter = new AuditReadOnlyFilter();

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private static void signInAs(Role role) {
        var p = new UserPrincipal(7L, "u@x.com", null, role,
                role.requiresFirm() ? 1L : null, role.requiresBranch() ? 10L : null, true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities()));
    }

    /** Runs the filter; true if the request reached the rest of the chain. */
    private boolean passes(String method, String requestUri, String servletPath) throws Exception {
        var req = new MockHttpServletRequest(method, requestUri);
        req.setServletPath(servletPath);
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(req, res, chain);
        boolean passed = chain.getRequest() != null;
        if (!passed) assertThat(res.getStatus()).isEqualTo(403);
        return passed;
    }

    @Test
    void auditPostToApiIsBlocked() throws Exception {
        signInAs(Role.AUDIT);
        assertThat(passes("POST", "/api/deals/1/notes", "/api/deals/1/notes")).isFalse();
    }

    @Test
    void auditPostWithPercentEncodedPrefixIsBlocked() throws Exception {
        signInAs(Role.AUDIT);
        // What the scan found: the raw URI no longer starts with /api/, but routing decodes it.
        assertThat(passes("POST", "/%61pi/deals/1/notes", "/api/deals/1/notes")).isFalse();
        assertThat(passes("POST", "/%61pi/compliance-documents/upload-url",
                "/api/compliance-documents/upload-url")).isFalse();
    }

    @Test
    void auditWriteOutsideApiIsBlockedToo() throws Exception {
        signInAs(Role.AUDIT);
        assertThat(passes("PUT", "/anything", "/anything")).isFalse();
        assertThat(passes("DELETE", "/api/users/me", "/api/users/me")).isFalse();
    }

    @Test
    void auditMayStillRefreshAndLogOut() throws Exception {
        signInAs(Role.AUDIT);
        assertThat(passes("POST", "/api/auth/refresh", "/api/auth/refresh")).isTrue();
        assertThat(passes("POST", "/api/auth/logout", "/api/auth/logout")).isTrue();
    }

    @Test
    void auditMaySignInAgainWhileHoldingASession() throws Exception {
        signInAs(Role.AUDIT);
        assertThat(passes("POST", "/api/auth/otp/request", "/api/auth/otp/request")).isTrue();
        assertThat(passes("POST", "/api/auth/otp/verify", "/api/auth/otp/verify")).isTrue();
    }

    @Test
    void exemptionIsExactNotAPrefix() throws Exception {
        signInAs(Role.AUDIT);
        assertThat(passes("POST", "/api/auth/refresh/x", "/api/auth/refresh/x")).isFalse();
        assertThat(passes("POST", "/api/auth/anything", "/api/auth/anything")).isFalse();
    }

    @Test
    void auditReadsPass() throws Exception {
        signInAs(Role.AUDIT);
        assertThat(passes("GET", "/api/deals", "/api/deals")).isTrue();
        assertThat(passes("HEAD", "/%61pi/deals", "/api/deals")).isTrue();
        assertThat(passes("OPTIONS", "/api/deals", "/api/deals")).isTrue();
    }

    @Test
    void otherRolesAreUnaffected() throws Exception {
        signInAs(Role.AGENT);
        assertThat(passes("POST", "/api/deals/1/notes", "/api/deals/1/notes")).isTrue();
    }

    @Test
    void anonymousRequestsAreLeftToSpringSecurity() throws Exception {
        assertThat(passes("POST", "/api/auth/otp/request", "/api/auth/otp/request")).isTrue();
    }
}
