package nz.amldock.auth;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.dto.MobileAuthResponse;
import nz.amldock.auth.otp.OtpPurpose;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.ApiException;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The mobile sign-in routes return tokens in the body and keep the web flow's checks. */
@ExtendWith(MockitoExtension.class)
class AuthServiceMobileTest {

    @Mock AuthenticationManager authManager;
    @Mock UserRepository users;
    @Mock JwtService jwt;
    @Mock RefreshTokenRepository refreshRepo;
    @Mock AuditService audit;
    @Mock OtpService otp;

    AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(authManager, users, jwt, refreshRepo, audit, otp, 7, false, "Lax");
    }

    private User agent() {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 5L);
        u.setEmail("agent@firm.nz");
        u.setRole(Role.AGENT);
        u.setActive(true);
        return u;
    }

    private void stubJwt() {
        when(jwt.generateAccessToken(anyLong(), anyString(), any(), any(), any(), anyInt()))
                .thenReturn("access-jwt");
        when(jwt.accessTtl()).thenReturn(Duration.ofMinutes(15));
    }

    @Test
    void verifyReturnsTokensInBody() {
        User u = agent();
        when(users.findByEmailIgnoreCase("agent@firm.nz")).thenReturn(Optional.of(u));
        stubJwt();

        MobileAuthResponse res = service.verifyLoginOtpMobile("agent@firm.nz", "123456");

        assertThat(res.accessToken()).isEqualTo("access-jwt");
        assertThat(res.refreshToken()).isNotBlank();
        assertThat(res.expiresIn()).isEqualTo(900);
        assertThat(res.user().role()).isEqualTo(Role.AGENT);

        // Only the hash is stored, never the raw token handed to the phone.
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshRepo).save(saved.capture());
        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(res.refreshToken()).hasSize(64);
        verify(audit).recordForUser(eq(5L), eq("agent@firm.nz"), eq(AuditAction.USER_LOGIN),
                eq("User"), eq(5L), anyString());
    }

    @Test
    void wrongCodeIsRejectedAndAudited() {
        User u = agent();
        when(users.findByEmailIgnoreCase("agent@firm.nz")).thenReturn(Optional.of(u));
        doThrow(new RuntimeException("bad")).when(otp).verify(u, "000000", OtpPurpose.LOGIN);

        assertThatThrownBy(() -> service.verifyLoginOtpMobile("agent@firm.nz", "000000"))
                .isInstanceOf(ApiException.class);
        verify(refreshRepo, never()).save(any());
        verify(audit).recordFailure(eq(5L), eq("agent@firm.nz"), eq(AuditAction.USER_OTP_FAILED),
                eq("User"), eq(5L), anyString());
    }

    @Test
    void rootCannotUseMobileSignIn() {
        User u = agent();
        u.setRole(Role.ROOT);
        when(users.findByEmailIgnoreCase("agent@firm.nz")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> service.verifyLoginOtpMobile("agent@firm.nz", "123456"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void refreshRotatesAndReturnsNewPair() {
        User u = agent();
        RefreshToken old = new RefreshToken();
        old.setUserId(5L);
        old.setExpiresAt(Instant.now().plus(Duration.ofDays(1)));
        when(refreshRepo.findByTokenHash(anyString())).thenReturn(Optional.of(old));
        when(users.findById(5L)).thenReturn(Optional.of(u));
        stubJwt();

        MobileAuthResponse res = service.refreshMobile("old-raw-token");

        assertThat(old.isActive()).isFalse();
        assertThat(res.refreshToken()).isNotEqualTo("old-raw-token");
        assertThat(res.accessToken()).isEqualTo("access-jwt");
    }

    @Test
    void refreshWithRevokedTokenFails() {
        RefreshToken old = new RefreshToken();
        old.setUserId(5L);
        old.setExpiresAt(Instant.now().plus(Duration.ofDays(1)));
        old.setRevokedAt(Instant.now());
        when(refreshRepo.findByTokenHash(anyString())).thenReturn(Optional.of(old));

        assertThatThrownBy(() -> service.refreshMobile("old-raw-token"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void logoutRevokesTokenWithoutAPrincipal() {
        User u = agent();
        RefreshToken rt = new RefreshToken();
        rt.setUserId(5L);
        rt.setExpiresAt(Instant.now().plus(Duration.ofDays(1)));
        when(refreshRepo.findByTokenHash(anyString())).thenReturn(Optional.of(rt));
        when(users.findById(5L)).thenReturn(Optional.of(u));

        service.logoutMobile("raw-token", null);

        assertThat(rt.isActive()).isFalse();
        verify(audit).recordForUser(eq(5L), eq("agent@firm.nz"), eq(AuditAction.USER_LOGOUT),
                eq("User"), eq(5L), anyString());
    }
}
