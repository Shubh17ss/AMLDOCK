package nz.amldock.user;

import nz.amldock.auth.RefreshTokenRepository;
import nz.amldock.auth.TokenStateCache;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** F2: a password change or reset must end every existing session (refresh token) of that user. */
@ExtendWith(MockitoExtension.class)
class UserServicePasswordTest {

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock PasswordEncoder encoder;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock TokenStateCache tokenStates;

    UserService service;
    User root;

    @BeforeEach
    void setUp() {
        service = new UserService(users, firms, branches, encoder, refreshTokens, tokenStates);
        root = new User();
        ReflectionTestUtils.setField(root, "id", 1L);
        root.setRole(Role.ROOT);
        root.setPasswordHash("old-hash");
        when(users.findById(1L)).thenReturn(Optional.of(root));
    }

    @Test
    void changeOwnPassword_revokesAllRefreshTokens() {
        when(encoder.matches("old", "old-hash")).thenReturn(true);
        when(encoder.encode("new-password")).thenReturn("new-hash");

        service.changeOwnPassword(1L, "old", "new-password");

        assertThat(root.getPasswordHash()).isEqualTo("new-hash");
        verify(refreshTokens).revokeAllForUser(eq(1L), any());
        assertThat(root.getTokenVersion()).isEqualTo(1);
        verify(tokenStates).evictAfterCommit(1L);
    }

    @Test
    void changeOwnPassword_wrongCurrentPassword_revokesNothing() {
        when(encoder.matches("wrong", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.changeOwnPassword(1L, "wrong", "new-password"))
                .isInstanceOf(BadRequestException.class);
        verify(refreshTokens, never()).revokeAllForUser(any(), any());
        assertThat(root.getTokenVersion()).isZero();
    }

    @Test
    void resetPassword_revokesAllRefreshTokens() {
        when(encoder.encode("new-password")).thenReturn("new-hash");

        service.resetPassword(1L, "new-password");

        assertThat(root.getPasswordHash()).isEqualTo("new-hash");
        verify(refreshTokens).revokeAllForUser(eq(1L), any());
        assertThat(root.getTokenVersion()).isEqualTo(1);
        verify(tokenStates).evictAfterCommit(1L);
    }
}
