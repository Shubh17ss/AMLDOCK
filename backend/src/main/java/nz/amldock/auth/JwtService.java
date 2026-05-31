package nz.amldock.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import nz.amldock.user.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(@Value("${amldock.jwt.secret}") String secret,
                      @Value("${amldock.jwt.access-ttl-minutes}") long accessTtlMinutes) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("amldock.jwt.secret must be at least 32 bytes (256 bits)");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.accessTtl = Duration.ofMinutes(accessTtlMinutes);
    }

    public String generateAccessToken(Long userId, String email, Role role, Long firmId, Long branchId) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("role", role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256);
        if (firmId != null) {
            builder.claim("firmId", firmId);
        }
        if (branchId != null) {
            builder.claim("branchId", branchId);
        }
        return builder.compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Duration accessTtl() {
        return accessTtl;
    }
}
