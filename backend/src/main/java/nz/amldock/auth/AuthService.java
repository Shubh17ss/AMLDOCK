package nz.amldock.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.dto.AuthResponse;
import nz.amldock.common.exception.ApiException;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class AuthService {

    public static final String REFRESH_COOKIE = "amldock_refresh";

    private final AuthenticationManager authManager;
    private final UserRepository users;
    private final JwtService jwt;
    private final RefreshTokenRepository refreshRepo;
    private final AuditService audit;
    private final Duration refreshTtl;
    private final SecureRandom rng = new SecureRandom();

    public AuthService(AuthenticationManager authManager,
                       UserRepository users,
                       JwtService jwt,
                       RefreshTokenRepository refreshRepo,
                       AuditService audit,
                       @Value("${JWT_REFRESH_TTL_DAYS:7}") long refreshTtlDays) {
        this.authManager = authManager;
        this.users = users;
        this.jwt = jwt;
        this.refreshRepo = refreshRepo;
        this.audit = audit;
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
    }

    @Transactional
    public AuthResponse login(String email, String rawPassword, HttpServletResponse response) {
        try {
            Authentication auth = authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, rawPassword));
            User u = users.findByEmailIgnoreCase(auth.getName())
                    .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
            if (!u.isActive()) {
                throw new ApiException(HttpStatus.FORBIDDEN, "User is disabled");
            }
            issueCookies(u, response);
            audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_LOGIN, "User", u.getId(),
                    "User " + u.getEmail() + " logged in");
            return toAuthResponse(u);
        } catch (BadCredentialsException ex) {
            audit.record(AuditAction.USER_LOGIN_FAILED, "User", null,
                    "Failed login attempt for email " + email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
    }

    @Transactional
    public AuthResponse refresh(String rawRefresh, HttpServletResponse response) {
        if (rawRefresh == null || rawRefresh.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Missing refresh token");
        }
        String hash = sha256(rawRefresh);
        RefreshToken rt = refreshRepo.findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));
        if (!rt.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token expired or revoked");
        }
        User u = users.findById(rt.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
        if (!u.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User is disabled");
        }
        // rotate
        rt.setRevokedAt(Instant.now());
        issueCookies(u, response);
        return toAuthResponse(u);
    }

    @Transactional(readOnly = true)
    public AuthResponse me(Long userId) {
        User u = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
        return toAuthResponse(u);
    }

    @Transactional
    public void logout(String rawRefresh, Long userId, HttpServletResponse response) {
        if (rawRefresh != null && !rawRefresh.isBlank()) {
            refreshRepo.findByTokenHash(sha256(rawRefresh))
                    .ifPresent(rt -> rt.setRevokedAt(Instant.now()));
        } else if (userId != null) {
            refreshRepo.revokeAllForUser(userId, Instant.now());
        }
        clearCookies(response);
        if (userId != null) {
            audit.record(AuditAction.USER_LOGOUT, "User", userId, "User logged out");
        }
    }

    private void issueCookies(User u, HttpServletResponse response) {
        String access = jwt.generateAccessToken(u.getId(), u.getEmail(), u.getRole(),
                u.getRealEstateFirmId(), u.getFirmBranchId());
        String rawRefresh = newRandomToken();
        RefreshToken rt = new RefreshToken();
        rt.setUserId(u.getId());
        rt.setTokenHash(sha256(rawRefresh));
        rt.setExpiresAt(Instant.now().plus(refreshTtl));
        refreshRepo.save(rt);

        addCookie(response, JwtAuthenticationFilter.ACCESS_COOKIE, access,
                (int) jwt.accessTtl().toSeconds(), "/");
        addCookie(response, REFRESH_COOKIE, rawRefresh,
                (int) refreshTtl.toSeconds(), "/api/auth");
    }

    private void clearCookies(HttpServletResponse response) {
        addCookie(response, JwtAuthenticationFilter.ACCESS_COOKIE, "", 0, "/");
        addCookie(response, REFRESH_COOKIE, "", 0, "/api/auth");
    }

    private void addCookie(HttpServletResponse response, String name, String value, int maxAgeSeconds, String path) {
        Cookie c = new Cookie(name, value);
        c.setHttpOnly(true);
        c.setSecure(false); // dev only — flip to true behind HTTPS in prod
        c.setPath(path);
        c.setMaxAge(maxAgeSeconds);
        c.setAttribute("SameSite", "Lax");
        response.addCookie(c);
    }

    private String newRandomToken() {
        byte[] buf = new byte[48];
        rng.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(input.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private AuthResponse toAuthResponse(User u) {
        return new AuthResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole(),
                u.getRealEstateFirmId(), u.getFirmBranchId());
    }
}
