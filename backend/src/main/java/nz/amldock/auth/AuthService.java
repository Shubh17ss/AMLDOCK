package nz.amldock.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.dto.AuthResponse;
import nz.amldock.auth.dto.MembershipSummary;
import nz.amldock.auth.dto.MobileAuthResponse;
import nz.amldock.auth.otp.OtpPurpose;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.ApiException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.FirmMembership;
import nz.amldock.user.MembershipService;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    public static final String REFRESH_COOKIE = "amldock_refresh";

    private final AuthenticationManager authManager;
    private final UserRepository users;
    private final JwtService jwt;
    private final RefreshTokenRepository refreshRepo;
    private final AuditService audit;
    private final OtpService otp;
    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;
    private final MembershipService memberships;
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
                       RealEstateFirmRepository firms,
                       FirmBranchRepository branches,
                       MembershipService memberships,
                       @Value("${JWT_REFRESH_TTL_DAYS:7}") long refreshTtlDays,
                       @Value("${COOKIE_SECURE:true}") boolean secureCookies,
                       @Value("${COOKIE_SAME_SITE:Lax}") String sameSite) {
        this.authManager = authManager;
        this.users = users;
        this.jwt = jwt;
        this.refreshRepo = refreshRepo;
        this.secureCookies = secureCookies;
        this.sameSite = sameSite;
        this.audit = audit;
        this.otp = otp;
        this.firms = firms;
        this.branches = branches;
        this.memberships = memberships;
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
    }

    /* ---------- email + OTP login (all roles except ROOT) ---------- */

    /**
     * Step 1 of the passwordless flow: email a one-time code.
     *
     * <p>Answers the same way for every address. A code goes out only to an active, non-ROOT
     * account; an unknown, disabled or administrator address gets the same empty success, and so
     * does an account that has hit the per-user issue limit, since a 429 only real accounts can
     * reach would be the same oracle (security scan F5). Email delivery is {@code @Async}, so the
     * timing doesn't differ much either. Abuse is held back per IP by {@link LoginRateLimitFilter}.
     *
     * <p>Not {@code @Transactional}: the throttle's 429 is thrown inside {@code OtpService.issue}'s
     * transaction, and swallowing it inside an outer one would leave that marked rollback-only and
     * fail at commit. Issue and audit each commit on their own, as in {@link #verifyLoginOtp}.
     */
    public void requestLoginOtp(String email) {
        User u = users.findByEmailIgnoreCase(email).orElse(null);
        if (u == null || u.getRole() == Role.ROOT || !u.isActive()) {
            log.info("Login OTP requested for an ineligible address; nothing sent");
            return;
        }
        try {
            otp.issue(u, OtpPurpose.LOGIN);
        } catch (ApiException ex) {
            if (ex.getStatus() != HttpStatus.TOO_MANY_REQUESTS) throw ex;
            log.info("Login OTP for user {} not re-issued: per-user limit reached", u.getId());
            return;
        }
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_OTP_REQUESTED, "User", u.getId(),
                "Login OTP requested for " + u.getEmail());
    }

    /**
     * Step 2: verify the code and issue session cookies.
     *
     * <p>Not {@code @Transactional}, on purpose: this endpoint is public, and a transaction around
     * it held a pooled connection while the OTP bookkeeping and the failure audit each took a
     * second one in REQUIRES_NEW. Ten concurrent wrong guesses then held the whole pool and every
     * request in the app waited out the connection timeout. Without it, each step commits on its
     * own and a request holds at most one connection at a time.
     */
    public AuthResponse verifyLoginOtp(String email, String code, HttpServletResponse response) {
        User u = checkLoginOtp(email, code);
        FirmMembership m = sessionStart(u);
        issueCookies(u, m, response);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_LOGIN, "User", u.getId(),
                "User " + u.getEmail() + " logged in via OTP");
        return toAuthResponse(u, m);
    }

    /**
     * Step 2 for the native mobile app: same checks as {@link #verifyLoginOtp}, but the tokens go
     * back in the body instead of cookies. Not {@code @Transactional}, for the same reason.
     */
    public MobileAuthResponse verifyLoginOtpMobile(String email, String code) {
        User u = checkLoginOtp(email, code);
        MobileAuthResponse tokens = mintMobileTokens(u, sessionStart(u));
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_LOGIN, "User", u.getId(),
                "User " + u.getEmail() + " logged in via OTP (mobile app)");
        return tokens;
    }

    private User checkLoginOtp(String email, String code) {
        User u = activeNonRoot(email);
        try {
            otp.verify(u, code, OtpPurpose.LOGIN);
        } catch (RuntimeException ex) {
            // recordFailure, not recordForUser: this method is @Transactional and is about to throw,
            // which would roll an ordinary audit write back along with it. A failed sign-in attempt
            // leaving no trace is precisely the wrong way round.
            audit.recordFailure(u.getId(), u.getEmail(), AuditAction.USER_OTP_FAILED, "User", u.getId(),
                    "Login OTP verification failed for " + u.getEmail());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        return u;
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
            // recordFailure, not record: this method is @Transactional and is about to throw, so a
            // row written in its transaction was rolled back with it, and password guessing on
            // this route left no trail at all (C-10). No actor: nobody has proved who they are, so
            // the address they typed goes in the summary, bounded because the caller chose it.
            audit.recordFailure(null, null, AuditAction.USER_LOGIN_FAILED, "User", null,
                    "Failed admin login attempt for email " + boundedEmail(email));
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        // A right password on the wrong route is worth seeing too: it is a real account's
        // password being tried against the administrator's door.
        if (u.getRole() != Role.ROOT) {
            audit.recordFailure(u.getId(), u.getEmail(), AuditAction.USER_LOGIN_FAILED, "User", u.getId(),
                    "Admin login refused for " + u.getEmail() + ": not the platform administrator");
            throw new ApiException(HttpStatus.FORBIDDEN, "This route is for the platform administrator only");
        }
        if (!u.isActive()) {
            audit.recordFailure(u.getId(), u.getEmail(), AuditAction.USER_LOGIN_FAILED, "User", u.getId(),
                    "Admin login refused for " + u.getEmail() + ": account disabled");
            throw new ApiException(HttpStatus.FORBIDDEN, "User is disabled");
        }
        otp.issue(u, OtpPurpose.ADMIN_LOGIN);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_OTP_REQUESTED, "User", u.getId(),
                "Admin login OTP requested for " + u.getEmail());
    }

    /**
     * Step 2: verify the ROOT second-factor code and issue session cookies. Not
     * {@code @Transactional}, for the same reason as {@link #verifyLoginOtp}.
     */
    public AuthResponse adminVerify(String email, String code, HttpServletResponse response) {
        User u = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code"));
        if (u.getRole() != Role.ROOT || !u.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        try {
            otp.verify(u, code, OtpPurpose.ADMIN_LOGIN);
        } catch (RuntimeException ex) {
            audit.recordFailure(u.getId(), u.getEmail(), AuditAction.USER_OTP_FAILED, "User", u.getId(),
                    "Admin OTP verification failed for " + u.getEmail());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired code");
        }
        issueCookies(u, null, response);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.USER_LOGIN, "User", u.getId(),
                "ROOT " + u.getEmail() + " logged in via password + OTP");
        return toAuthResponse(u, null);
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
        Session s = rotateRefresh(rawRefresh);
        issueCookies(s.user(), s.membership(), response);
        return toAuthResponse(s.user(), s.membership());
    }

    /** Mobile refresh: rotates the body-supplied token and returns the new pair in the body. */
    @Transactional
    public MobileAuthResponse refreshMobile(String rawRefresh) {
        Session s = rotateRefresh(rawRefresh);
        return mintMobileTokens(s.user(), s.membership());
    }

    /* ---------- moving a session between reporting entities ---------- */

    /**
     * Moves the caller's web session into another entity they are active in: a fresh cookie pair
     * minted from that membership, the old refresh token revoked, and the membership made the
     * account's home so the next sign-in starts there too. Every role and scope check downstream
     * reads the token, so this is all an entity switch needs to be.
     */
    @Transactional
    public AuthResponse switchEntity(UserPrincipal principal, Long membershipId, String rawRefresh,
                                     HttpServletResponse response) {
        Session s = switchTo(principal, membershipId, rawRefresh);
        issueCookies(s.user(), s.membership(), response);
        return toAuthResponse(s.user(), s.membership());
    }

    /** The mobile app's switch: same checks, tokens in the body. */
    @Transactional
    public MobileAuthResponse switchEntityMobile(UserPrincipal principal, Long membershipId, String rawRefresh) {
        Session s = switchTo(principal, membershipId, rawRefresh);
        return mintMobileTokens(s.user(), s.membership());
    }

    private Session switchTo(UserPrincipal principal, Long membershipId, String rawRefresh) {
        User u = users.findById(principal.id())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
        FirmMembership m = memberships.ownedBy(u.getId(), membershipId);
        if (!m.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are no longer active in that reporting entity");
        }
        // A deactivated entity can still be switched into: its firm-level staff keep read-only
        // access through its retention period (InactiveScopeReadOnlyFilter). Its branch-level
        // staff never get here — their memberships went off with its branches.
        if (rawRefresh != null && !rawRefresh.isBlank()) {
            refreshRepo.findByTokenHash(sha256(rawRefresh))
                    .filter(rt -> rt.getUserId().equals(u.getId()))
                    .ifPresent(rt -> rt.setRevokedAt(Instant.now()));
        }
        memberships.makeHome(u, m);
        audit.recordForUser(u.getId(), u.getEmail(), AuditAction.ENTITY_SWITCHED, "User", u.getId(),
                "Switched to reporting entity " + m.getRealEstateFirmId() + " as " + m.getRole());
        return new Session(u, m);
    }

    /**
     * Mobile sign-out. Revokes the given refresh token, or every session of the signed-in user
     * when none is sent. Holding the raw token is proof enough to revoke it, so this works even
     * after the access token has expired.
     */
    @Transactional
    public void logoutMobile(String rawRefresh, Long userId) {
        Long actor = userId;
        if (rawRefresh != null && !rawRefresh.isBlank()) {
            RefreshToken rt = refreshRepo.findByTokenHash(sha256(rawRefresh)).orElse(null);
            if (rt != null) {
                rt.setRevokedAt(Instant.now());
                if (actor == null) actor = rt.getUserId();
            }
        } else if (userId != null) {
            refreshRepo.revokeAllForUser(userId, Instant.now());
        }
        // recordForUser, not record: with an expired access token there is no principal in the
        // security context, so the actor comes from the revoked token's owner instead.
        if (actor != null) {
            users.findById(actor).ifPresent(u -> audit.recordForUser(u.getId(), u.getEmail(),
                    AuditAction.USER_LOGOUT, "User", u.getId(), "User logged out (mobile app)"));
        }
    }

    /** A session: the account, and the membership it is in (null for ROOT and AUDIT). */
    private record Session(User user, FirmMembership membership) {}

    /**
     * Validates and revokes a refresh token, returning its active owner and the entity the session
     * was in. Caller issues the new pair. A session whose membership has since been switched off
     * falls back to wherever a fresh sign-in would start — though switching one off also revokes
     * every refresh token the account holds, so in practice that is a token older than V68.
     */
    private Session rotateRefresh(String rawRefresh) {
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
        FirmMembership m = rt.getMembershipId() == null ? null
                : memberships.ownedBy(u.getId(), rt.getMembershipId());
        if (m == null || !m.isActive()) {
            m = sessionStart(u);
        }
        // rotate
        rt.setRevokedAt(Instant.now());
        return new Session(u, m);
    }

    /** The session's own entity, from the token — not the account's home, which another device may have moved. */
    @Transactional(readOnly = true)
    public AuthResponse me(UserPrincipal principal) {
        User u = users.findById(principal.id())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
        return toAuthResponse(u, sessionIn(u, principal.realEstateFirmId()));
    }

    /**
     * Issues a fresh cookie pair for a user whose identity claims have moved under them.
     *
     * <p>Exists for the email change. The access token carries an {@code email} claim that
     * {@code AuditService} reads for {@code actorEmail}, and
     * {@code JwtAuthenticationFilter} rebuilds the principal from it without consulting the
     * database — so after a change the old address would keep signing every audit row this user
     * produced for up to the token's fifteen-minute life. Re-issuing costs one row in
     * {@code refresh_token} and keeps the trail honest.
     *
     * <p>It also spares the user a forced sign-out: they changed an address, not a password, and
     * being logged out for it would read as something having gone wrong.
     */
    @Transactional
    public AuthResponse reissueSession(User u, UserPrincipal current, HttpServletResponse response) {
        FirmMembership m = sessionIn(u, current.realEstateFirmId());
        issueCookies(u, m, response);
        return toAuthResponse(u, m);
    }

    /** Where a new session starts: the home membership, or the first active one. Null for ROOT/AUDIT. */
    private FirmMembership sessionStart(User u) {
        return memberships.sessionStart(u).orElse(null);
    }

    /** The active membership in {@code firmId}, else where a new session would start. */
    private FirmMembership sessionIn(User u, Long firmId) {
        return memberships.activeIn(u.getId(), firmId).orElseGet(() -> sessionStart(u));
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

    private record TokenPair(String access, String refresh) {}

    /**
     * Signs an access token and stores a new hashed refresh token for the user. Role, firm and
     * branch come from the membership the session is in, so every check downstream — the
     * {@code @PreAuthorize} roles, DealScope, the firm and branch guards — answers for that entity.
     * ROOT and AUDIT have no membership and are described by their account.
     */
    private TokenPair mintTokens(User u, FirmMembership m) {
        Role role = m == null ? u.getRole() : m.getRole();
        Long firmId = m == null ? u.getRealEstateFirmId() : m.getRealEstateFirmId();
        Long branchId = m == null ? u.getFirmBranchId() : m.getFirmBranchId();
        String access = jwt.generateAccessToken(u.getId(), u.getEmail(), role, firmId, branchId,
                u.getTokenVersion());
        String rawRefresh = newRandomToken();
        RefreshToken rt = new RefreshToken();
        rt.setUserId(u.getId());
        rt.setMembershipId(m == null ? null : m.getId());
        rt.setTokenHash(sha256(rawRefresh));
        rt.setExpiresAt(Instant.now().plus(refreshTtl));
        refreshRepo.save(rt);
        return new TokenPair(access, rawRefresh);
    }

    private void issueCookies(User u, FirmMembership m, HttpServletResponse response) {
        TokenPair t = mintTokens(u, m);
        addCookie(response, JwtAuthenticationFilter.ACCESS_COOKIE, t.access(),
                (int) jwt.accessTtl().toSeconds(), "/");
        addCookie(response, REFRESH_COOKIE, t.refresh(),
                (int) refreshTtl.toSeconds(), "/api/auth");
    }

    private MobileAuthResponse mintMobileTokens(User u, FirmMembership m) {
        TokenPair t = mintTokens(u, m);
        return new MobileAuthResponse(t.access(), t.refresh(), jwt.accessTtl().toSeconds(), toAuthResponse(u, m));
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

    private AuthResponse toAuthResponse(User u, FirmMembership m) {
        Role role = m == null ? u.getRole() : m.getRole();
        Long firmId = m == null ? u.getRealEstateFirmId() : m.getRealEstateFirmId();
        Long branchId = m == null ? u.getFirmBranchId() : m.getFirmBranchId();

        List<FirmMembership> active = memberships.activeOf(u.getId());
        Map<Long, RealEstateFirm> firmById = firms.findAllById(
                        active.stream().map(FirmMembership::getRealEstateFirmId).distinct().toList())
                .stream().collect(Collectors.toMap(RealEstateFirm::getId, Function.identity()));
        Map<Long, FirmBranch> branchById = branches.findAllById(
                        active.stream().map(FirmMembership::getFirmBranchId)
                                .filter(java.util.Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(FirmBranch::getId, Function.identity()));
        // A deactivated entity is listed too, marked, since it can be switched into read-only.
        List<MembershipSummary> summaries = active.stream()
                .filter(x -> firmById.containsKey(x.getRealEstateFirmId()))
                .map(x -> {
                    RealEstateFirm f = firmById.get(x.getRealEstateFirmId());
                    FirmBranch b = x.getFirmBranchId() == null ? null : branchById.get(x.getFirmBranchId());
                    return new MembershipSummary(x.getId(), f.getId(), f.getPublicId(), f.getName(),
                            f.getCountry(),
                            x.getFirmBranchId(), b == null ? null : b.getName(), x.getRole(),
                            !f.isActive());
                })
                .toList();

        // The firm's public id rides along so a client can name the firm in a URL or call
        // /firms/{ref} without first listing firms to find it.
        String firmPublicId = firmId == null ? null
                : firmById.containsKey(firmId) ? firmById.get(firmId).getPublicId()
                : firms.findById(firmId).map(RealEstateFirm::getPublicId).orElse(null);
        return new AuthResponse(u.getId(), u.getEmail(), u.getFullName(), role,
                firmId, firmPublicId, branchId, m == null ? null : m.getId(), summaries);
    }

    /** An unauthenticated caller chooses this value; an email address is at most 254 characters. */
    private static final int MAX_AUDIT_EMAIL = 255;

    private static String boundedEmail(String email) {
        if (email == null) return null;
        return email.length() <= MAX_AUDIT_EMAIL ? email : email.substring(0, MAX_AUDIT_EMAIL);
    }
}
