package nz.amldock.auth;

import nz.amldock.audit.AuditService;
import nz.amldock.auth.otp.OtpPurpose;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.ApiException;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * F5: {@code POST /api/auth/otp/request} answers the same for every address, so it can't be used
 * to list which emails have accounts or which of them are disabled.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceLoginOtpTest {

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

    private User user(Role role, boolean active) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 5L);
        u.setEmail("someone@firm.nz");
        u.setRole(role);
        u.setActive(active);
        when(users.findByEmailIgnoreCase("someone@firm.nz")).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    void unknownEmailSucceedsQuietly() {
        when(users.findByEmailIgnoreCase("nobody@firm.nz")).thenReturn(Optional.empty());

        assertThatCode(() -> service.requestLoginOtp("nobody@firm.nz")).doesNotThrowAnyException();
        verifyNoInteractions(otp, audit);
    }

    @Test
    void disabledAccountSucceedsQuietly() {
        user(Role.AGENT, false);

        assertThatCode(() -> service.requestLoginOtp("someone@firm.nz")).doesNotThrowAnyException();
        verifyNoInteractions(otp, audit);
    }

    @Test
    void rootAddressSucceedsQuietly() {
        user(Role.ROOT, true);

        assertThatCode(() -> service.requestLoginOtp("someone@firm.nz")).doesNotThrowAnyException();
        verifyNoInteractions(otp, audit);
    }

    @Test
    void activeAccountGetsACode() {
        User u = user(Role.AGENT, true);

        service.requestLoginOtp("someone@firm.nz");

        verify(otp).issue(u, OtpPurpose.LOGIN);
    }

    @Test
    void perUserThrottleIsNotRevealed() {
        User u = user(Role.AGENT, true);
        doThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many codes"))
                .when(otp).issue(u, OtpPurpose.LOGIN);

        assertThatCode(() -> service.requestLoginOtp("someone@firm.nz")).doesNotThrowAnyException();
        verifyNoInteractions(audit);
    }

    @Test
    void otherFailuresStillSurface() {
        User u = user(Role.AGENT, true);
        doThrow(new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "boom"))
                .when(otp).issue(any(), any());

        assertThatThrownBy(() -> service.requestLoginOtp("someone@firm.nz"))
                .isInstanceOf(ApiException.class);
    }
}
