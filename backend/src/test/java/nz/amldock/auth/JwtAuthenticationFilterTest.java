package nz.amldock.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import nz.amldock.user.Role;
import nz.amldock.user.TokenState;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * F6: an access token holds only while the user it names is still active and still at the token
 * version it was issued with. A change to the user ends it at once, not at expiry.
 */
@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    static final String SECRET = "test-only-secret-test-only-secret-0123456789";

    @Mock TokenStateCache tokenStates;

    final JwtService jwt = new JwtService(SECRET, 15);
    JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwt, tokenStates);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    /** Runs the filter with the token as a bearer header; returns who the request ran as, if anyone. */
    private Authentication run(String token) throws Exception {
        var req = new MockHttpServletRequest("GET", "/api/deals");
        req.addHeader("Authorization", "Bearer " + token);
        Authentication[] seen = new Authentication[1];
        filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest r, jakarta.servlet.ServletResponse s) {
                seen[0] = SecurityContextHolder.getContext().getAuthentication();
            }
        });
        return seen[0];
    }

    private String tokenAtVersion(int tv) {
        return jwt.generateAccessToken(7L, "a@firm.nz", Role.AGENT, 1L, 10L, tv);
    }

    @Test
    void aCurrentTokenAuthenticates() throws Exception {
        when(tokenStates.get(7L)).thenReturn(Optional.of(new TokenState(2, true)));

        Authentication auth = run(tokenAtVersion(2));

        assertThat(auth).isNotNull();
        assertThat(((UserPrincipal) auth.getPrincipal()).role()).isEqualTo(Role.AGENT);
    }

    @Test
    void aTokenFromBeforeAChangeIsRefused() throws Exception {
        when(tokenStates.get(7L)).thenReturn(Optional.of(new TokenState(3, true)));

        assertThat(run(tokenAtVersion(2))).isNull();
    }

    @Test
    void aDeactivatedUserIsRefused() throws Exception {
        when(tokenStates.get(7L)).thenReturn(Optional.of(new TokenState(2, false)));

        assertThat(run(tokenAtVersion(2))).isNull();
    }

    @Test
    void aDeletedUserIsRefused() throws Exception {
        when(tokenStates.get(7L)).thenReturn(Optional.empty());

        assertThat(run(tokenAtVersion(0))).isNull();
    }

    @Test
    void aTokenWithoutTheClaimCountsAsVersionZero() throws Exception {
        // Shape of a token minted before the deploy (and of the k6 perf tokens).
        String legacy = Jwts.builder()
                .subject("7").claim("email", "a@firm.nz").claim("role", "AGENT")
                .claim("firmId", 1L).claim("branchId", 10L)
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        when(tokenStates.get(7L)).thenReturn(Optional.of(new TokenState(0, true)));
        assertThat(run(legacy)).isNotNull();

        SecurityContextHolder.clearContext();
        when(tokenStates.get(7L)).thenReturn(Optional.of(new TokenState(1, true)));
        assertThat(run(legacy)).isNull();
    }
}
