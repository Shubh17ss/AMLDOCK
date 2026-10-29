package nz.amldock.auth;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
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
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Failed attempts on the administrator's login route leave a trail (C-10).
 *
 * <p>The audit row used to join adminLogin's transaction, which the 401 that followed rolled back,
 * so password guessing on this route was invisible. These pin that the failure goes through
 * {@code recordFailure}, the REQUIRES_NEW path that commits on its own.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceAdminLoginTest {

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

    @Test
    void aWrongPasswordIsRecordedOutsideTheFailingTransaction() {
        when(authManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        assertThatThrownBy(() -> service.adminLogin("root@example.test", "wrong"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));

        ArgumentCaptor<String> summary = ArgumentCaptor.forClass(String.class);
        verify(audit).recordFailure(isNull(), isNull(), eq(AuditAction.USER_LOGIN_FAILED), eq("User"),
                isNull(), summary.capture());
        assertThat(summary.getValue()).contains("root@example.test");
        // The joining write is the one that was lost; it must not be the one used.
        verify(audit, never()).record(any(), any(), any(), any());
    }

    @Test
    void anOverlongEmailIsBoundedRatherThanAllowedToFailTheInsert() {
        when(authManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
        String huge = "a".repeat(5000) + "@example.test";

        assertThatThrownBy(() -> service.adminLogin(huge, "wrong")).isInstanceOf(ApiException.class);

        ArgumentCaptor<String> summary = ArgumentCaptor.forClass(String.class);
        verify(audit).recordFailure(isNull(), isNull(), eq(AuditAction.USER_LOGIN_FAILED), anyString(),
                isNull(), summary.capture());
        assertThat(summary.getValue().length()).isLessThan(400);
    }

    @Test
    void aRealPasswordOfANonRootAccountIsRefusedAndRecorded() {
        User agent = new User();
        ReflectionTestUtils.setField(agent, "id", 42L);
        agent.setEmail("agent@firm.nz");
        agent.setRole(Role.AGENT);
        agent.setActive(true);
        when(authManager.authenticate(any())).thenReturn(
                new UsernamePasswordAuthenticationToken("agent@firm.nz", null, List.of()));
        when(users.findByEmailIgnoreCase("agent@firm.nz")).thenReturn(Optional.of(agent));

        assertThatThrownBy(() -> service.adminLogin("agent@firm.nz", "right"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));

        verify(audit).recordFailure(eq(42L), eq("agent@firm.nz"), eq(AuditAction.USER_LOGIN_FAILED),
                eq("User"), eq(42L), anyString());
        verify(otp, never()).issue(any(), any());
        verify(audit, never()).recordForUser(anyLong(), any(), eq(AuditAction.USER_OTP_REQUESTED), any(), any(), any());
    }
}
