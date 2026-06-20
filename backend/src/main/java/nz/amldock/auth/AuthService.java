package nz.amldock.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.dto.AuthResponse;
import nz.amldock.auth.otp.OtpPurpose;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.ApiException;
import nz.amldock.user.Role;
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
    private final OtpService otp;
    private final Duration refreshTtl;
    private final SecureRandom rng = new SecureRandom();

    private final boolean secureCookies;
    private final String sameSite;

    public AuthService(AuthenticationManager authManager,
                       UserRepository users,
                       JwtService jwt,
                       RefreshTokenRepository refreshRepo,
                       AuditService audit,
                       OtpService otp,
                       @Value("${JWT_REFRESH_TTL_DAYS:7}") long refreshTtlDays,
                       @Value("${COOKIE_SECURE:false}") boolean secureCookies,
                       @Value("${COOKIE_SAME_SITE:Lax}") String sameSite) {
        this.authManager = authManager;
        this.users = users;
        this.jwt = jwt;
        this.refreshRepo = refreshRepo;
        this.secureCookies = secureCookies;
        this.sameSite = sameSite;
        this.audit = audit;
        this.otp = otp;
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
    }

    /* ---------- email + OTP login (all roles except ROOT) ---------- */

    /**
     * Step 1 of the passwordless flow: email a one-time code. Surfaces a clear error when the
     * email isn't attached to an eligible account (note: this intentionally allows the caller to
     * tell which emails have accounts — acceptable for an internal tool).
     */
    @Transactional
    public void requestLoginOtp(String email) {
        User u = users.findByEmailIgnoreCase(email).orElse(null);
        // ROOT is not a normal-route account — give the same generic response as an unknown email
        // so the normal sign-in never reveals that an email belongs to the administrator.
        if (u == null || u.getRole() == Role.ROOT) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No user is attached to this email");
        }
        if (!u.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This account is disabled — contact your administrator");
        }
        otp.issue(u, OtpPurpose.LOGIN);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_OTP_REQUESTED, "User", u.getId(),
                "Login OTP requested for " + u.getEmail());
    }

    /** Step 2: verify the code and issue session cookies. */
    @Transactional
    public AuthResponse verifyLoginOtp(String email, String code, HttpServletResponse response) {
        User u = activeNonRoot(email);
        try {
            otp.verify(u, code, OtpPurpose.LOGIN);
        } catch (RuntimeException ex) {
            audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_OTP_FAILED, "User", u.getId(),
                    "Login OTP verification failed for " + u.getEmail());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        issueCookies(u, response);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_LOGIN, "User", u.getId(),
                "User " + u.getEmail() + " logged in via OTP");
        return toAuthResponse(u);
    }

    /* ---------- ROOT password + OTP login (dedicated route) ---------- */

    /** Step 1: verify the ROOT password, then email the second-factor code. */
    @Transactional
    public void adminLogin(String email, String rawPassword) {
        User u;
        try {
            Authentication auth = authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, rawPassword));
            u = users.findByEmailIgnoreCase(auth.getName())
                    .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        } catch (BadCredentialsException ex) {
            audit.record(AuditAction.USER_LOGIN_FAILED, "User", null,
                    "Failed admin login attempt for email " + email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        if (u.getRole() != Role.ROOT) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This route is for the platform administrator only");
        }
        if (!u.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User is disabled");
        }
        otp.issue(u, OtpPurpose.ADMIN_LOGIN);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_OTP_REQUESTED, "User", u.getId(),
                "Admin login OTP requested for " + u.getEmail());
    }

    /** Step 2: verify the ROOT second-factor code and issue session cookies. */
    @Transactional
    public AuthResponse adminVerify(String email, String code, HttpServletResponse response) {
        User u = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code"));
        if (u.getRole() != Role.ROOT || !u.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        try {
            otp.verify(u, code, OtpPurpose.ADMIN_LOGIN);
        } catch (RuntimeException ex) {
            audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_OTP_FAILED, "User", u.getId(),
                    "Admin OTP verification failed for " + u.getEmail());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        issueCookies(u, response);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_LOGIN, "User", u.getId(),
                "ROOT " + u.getEmail() + " logged in via password + OTP");
        return toAuthResponse(u);
    }

    private User activeNonRoot(String email) {
        User u = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code"));
        if (u.getRole() == Role.ROOT || !u.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        return u;
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
        c.setSecure(secureCookies);
        c.setPath(path);
        c.setMaxAge(maxAgeSeconds);
        c.setAttribute("SameSite", sameSite);
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
