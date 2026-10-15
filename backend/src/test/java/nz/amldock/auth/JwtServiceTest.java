package nz.amldock.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.JwtException;
import nz.amldock.user.Role;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The signing key must come from the environment. Access tokens are trusted without a database
 * lookup, so a key anyone can know is a forgeable ROOT session (security audit, JWT fallback).
 */
class JwtServiceTest {

    static final String SECRET = "test-only-secret-test-only-secret-0123456789";

    @Test
    void refusesToStartWithoutASecret() {
        assertThatThrownBy(() -> new JwtService("", 15))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET is not set");
        assertThatThrownBy(() -> new JwtService("   ", 15))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService(null, 15))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void refusesTheRetiredSourceDefault() {
        // It is in the repository's history, so supplying it explicitly is no better than unset.
        assertThatThrownBy(() -> new JwtService(JwtService.RETIRED_DEFAULT, 15))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("retired");
    }

    @Test
    void refusesAShortSecret() {
        assertThatThrownBy(() -> new JwtService("too-short", 15))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }

    @Test
    void aConfiguredSecretSignsAndVerifies() {
        JwtService jwt = new JwtService(SECRET, 15);

        String token = jwt.generateAccessToken(7L, "a@firm.nz", Role.AGENT, 100L, 10L);
        Claims claims = jwt.parse(token);

        assertThat(claims.getSubject()).isEqualTo("7");
        assertThat(claims.get("role", String.class)).isEqualTo("AGENT");
    }

    @Test
    void aTokenSignedWithTheRetiredDefaultIsRejected() {
        // The forgery the fallback allowed: a ROOT token signed with the public value.
        JwtService jwt = new JwtService(SECRET, 15);
        String forged = Jwts.builder()
                .subject("1")
                .claim("role", "ROOT")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(JwtService.RETIRED_DEFAULT.getBytes(StandardCharsets.UTF_8)),
                        Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> jwt.parse(forged)).isInstanceOf(JwtException.class);
    }
}
