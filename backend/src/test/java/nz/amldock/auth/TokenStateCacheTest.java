package nz.amldock.auth;

import nz.amldock.user.TokenState;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenStateCacheTest {

    @Mock UserRepository users;

    final AtomicLong now = new AtomicLong(1_000_000);

    TokenStateCache cache() {
        return new TokenStateCache(users, Duration.ofSeconds(30), now::get);
    }

    @Test
    void readsOncePerTtl() {
        when(users.findTokenState(7L)).thenReturn(Optional.of(new TokenState(1, true)));
        TokenStateCache cache = cache();

        cache.get(7L);
        now.addAndGet(29_999);
        assertThat(cache.get(7L)).contains(new TokenState(1, true));
        verify(users, times(1)).findTokenState(7L);

        now.addAndGet(1);
        cache.get(7L);
        verify(users, times(2)).findTokenState(7L);
    }

    @Test
    void evictionForcesAFreshRead() {
        when(users.findTokenState(7L))
                .thenReturn(Optional.of(new TokenState(1, true)))
                .thenReturn(Optional.of(new TokenState(2, true)));
        TokenStateCache cache = cache();

        cache.get(7L);
        cache.evictAfterCommit(7L); // no transaction here, so it evicts at once

        assertThat(cache.get(7L)).contains(new TokenState(2, true));
    }

    @Test
    void aMissingUserIsCachedAsMissing() {
        when(users.findTokenState(7L)).thenReturn(Optional.empty());
        TokenStateCache cache = cache();

        assertThat(cache.get(7L)).isEmpty();
        assertThat(cache.get(7L)).isEmpty();
        verify(users, times(1)).findTokenState(7L);
    }
}
