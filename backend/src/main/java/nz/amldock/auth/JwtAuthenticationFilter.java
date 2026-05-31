package nz.amldock.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ACCESS_COOKIE = "amldock_access";

    private final JwtService jwt;

    public JwtAuthenticationFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims claims = jwt.parse(token);
                Long userId = Long.parseLong(claims.getSubject());
                String email = claims.get("email", String.class);
                String roleName = claims.get("role", String.class);
                Number firmIdNum = claims.get("firmId", Number.class);
                Long firmId = firmIdNum == null ? null : firmIdNum.longValue();
                Number branchIdNum = claims.get("branchId", Number.class);
                Long branchId = branchIdNum == null ? null : branchIdNum.longValue();
                Role role = Role.valueOf(roleName);

                UserPrincipal principal =
                        new UserPrincipal(userId, email, null, role, firmId, branchId, true);
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException | IllegalArgumentException ignored) {
                // invalid token — leave context empty, will be 401'd later if endpoint requires auth
            }
        }
        chain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (ACCESS_COOKIE.equals(c.getName())) {
                    return c.getValue();
                }
            }
        }
        return null;
    }
}
