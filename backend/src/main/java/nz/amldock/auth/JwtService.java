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

    /**
     * The fallback this service used to start with when JWT_SECRET was unset. It is in the
     * repository's history, so anyone who has read the code can sign tokens with it — refused
     * even when supplied explicitly.
     */
    static final String RETIRED_DEFAULT = "dev-secret-change-me-dev-secret-change-me-32chars";

    private final SecretKey key;
    private final Duration accessTtl;

    /**
     * There is deliberately no default: every claim in an access token (role, firm, branch) is
     * trusted without a database lookup, so a guessable key is a forgeable ROOT session. A
     * missing secret stops startup rather than falling back to anything.
     */
    public JwtService(@Value("${JWT_SECRET:}") String secret,
                      @Value("${amldock.jwt.access-ttl-minutes:15}") long accessTtlMinutes) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET is not set. Set it to a random value of at least 32 bytes "
                            + "(e.g. `openssl rand -base64 48`); there is no default.");
        }
        if (secret.equals(RETIRED_DEFAULT)) {
            throw new IllegalStateException(
                    "JWT_SECRET is set to the retired source default, which is public. Generate a new one.");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes (256 bits)");
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
