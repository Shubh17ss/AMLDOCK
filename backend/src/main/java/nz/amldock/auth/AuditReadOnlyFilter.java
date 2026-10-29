package nz.amldock.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Makes the AUDIT role read-only, for real.
 *
 * The alternative — leaving AUDIT out of every write gate — is a promise spread across dozens of
 * {@code @PreAuthorize} annotations that has to be re-made correctly every time somebody adds an
 * endpoint. One person forgetting is a silent hole. This is the single rule instead: an auditor
 * may not issue a state-changing request to the API, whatever any annotation says.
 *
 * Runs after {@link JwtAuthenticationFilter}, so the principal is resolved by the time it reads
 * the role.
 *
 * <p>Fails closed: a read-only principal is refused every non-safe method on every path. The path
 * is consulted only to exempt the sign-in, refresh and logout endpoints (POSTs the session depends
 * on; they change the caller's own token, not any record), and it is the decoded, normalised servlet path, compared
 * exactly. A raw-URI prefix test used to decide this, and {@code /%61pi/...} slipped past it while
 * Spring MVC still routed it to {@code /api/...}. Now an encoding trick can only over-block.
 */
@Component
public class AuditReadOnlyFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    /** Session endpoints: they change the caller's own sign-in, never a record. Matched exactly. */
    private static final Set<String> EXEMPT_PATHS = Set.of(
            "/api/auth/otp/request", "/api/auth/otp/verify",
            "/api/auth/admin/login", "/api/auth/admin/verify",
            "/api/auth/refresh", "/api/auth/logout");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (isBlocked(request)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN,
                    "The audit role has read-only access");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isBlocked(HttpServletRequest request) {
        if (SAFE_METHODS.contains(request.getMethod())) return false;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean readOnly = auth != null
                && auth.getPrincipal() instanceof UserPrincipal principal
                && principal.role().isReadOnly();
        if (!readOnly) return false;

        return !EXEMPT_PATHS.contains(request.getServletPath());
    }
}
