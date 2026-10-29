package nz.amldock.common.config;

import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The first ROOT comes only from credentials the deployment set. The old source fallbacks
 * (a fixed email and Admin123!) are public, so a database seeded from them had a known
 * administrator password.
 */
class DataSeederTest {

    final UserRepository users = mock(UserRepository.class);
    final PasswordEncoder encoder = new BCryptPasswordEncoder(4);

    @Test
    void noEmailSeedsNothing() {
        new DataSeeder(users, encoder, "", "A-strong-one-2026", "Root").run();
        verify(users, never()).save(any());
    }

    @Test
    void noPasswordSeedsNothing() {
        when(users.existsByEmailIgnoreCase("root@firm.nz")).thenReturn(false);
        new DataSeeder(users, encoder, "root@firm.nz", "", "Root").run();
        verify(users, never()).save(any());
    }

    @Test
    void theRetiredDefaultPasswordIsRefused() {
        when(users.existsByEmailIgnoreCase("root@firm.nz")).thenReturn(false);
        new DataSeeder(users, encoder, "root@firm.nz", DataSeeder.RETIRED_DEFAULT_PASSWORD, "Root").run();
        verify(users, never()).save(any());
    }

    @Test
    void chosenCredentialsSeedARoot() {
        when(users.existsByEmailIgnoreCase("root@firm.nz")).thenReturn(false);
        new DataSeeder(users, encoder, "Root@Firm.nz", "A-strong-one-2026", "Root").run();

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().getEmail()).isEqualTo("root@firm.nz");
        assertThat(saved.getValue().getRole()).isEqualTo(Role.ROOT);
        assertThat(encoder.matches("A-strong-one-2026", saved.getValue().getPasswordHash())).isTrue();
    }

    @Test
    void anExistingRootIsLeftAlone() {
        when(users.existsByEmailIgnoreCase("root@firm.nz")).thenReturn(true);
        new DataSeeder(users, encoder, "root@firm.nz", "", "Root").run();
        verify(users, never()).save(any());
    }
}
