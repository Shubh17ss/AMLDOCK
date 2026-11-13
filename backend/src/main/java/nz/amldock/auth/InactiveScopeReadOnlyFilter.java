package nz.amldock.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Makes a deactivated reporting entity read-only to the people still signed in to it.
 *
 * <p>Deactivating an entity switches off its branches and with them every branch-level member, who
 * then cannot sign in. Its compliance officers, senior managers and finance staff keep their
 * memberships so they can still read its records through the retention period — and this is what
 * stops them changing any. Like {@link AuditReadOnlyFilter}, one rule at the door rather than a
 * check every endpoint must remember; the per-record checks (ScopeStatusGuard) still hold for
 * ROOT, who belongs to no entity and so is never stopped here.
 *
 * <p>Only state-changing requests pay for the lookup. The session endpoints are exempt — they
 * change the caller's own sign-in, and switching to another entity is how someone serving two
 * gets back to the one that is still open.
 */
@Component
public class InactiveScopeReadOnlyFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> EXEMPT_PATHS = Set.of(
            "/api/auth/otp/request", "/api/auth/otp/verify",
            "/api/auth/admin/login", "/api/auth/admin/verify",
            "/api/auth/refresh", "/api/auth/logout", "/api/auth/switch-entity",
            "/api/auth/mobile/otp/verify", "/api/auth/mobile/refresh",
            "/api/auth/mobile/logout", "/api/auth/mobile/switch-entity");

    private final RealEstateFirmRepository firms;

    public InactiveScopeReadOnlyFilter(RealEstateFirmRepository firms) {
        this.firms = firms;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String closed = closedEntity(request);
        if (closed != null) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN,
                    closed + " is deactivated — you have read-only access to it");
            return;
        }
        chain.doFilter(request, response);
    }

    /** The name of the deactivated entity this write targets, or null if it may go ahead. */
    private String closedEntity(HttpServletRequest request) {
        if (SAFE_METHODS.contains(request.getMethod())) return null;
        if (EXEMPT_PATHS.contains(request.getServletPath())) return null;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) return null;
        if (principal.realEstateFirmId() == null) return null;

        return firms.findById(principal.realEstateFirmId())
                .filter(f -> !f.isActive())
                .map(RealEstateFirm::getName)
                .orElse(null);
    }
}
