package nz.amldock.auth;

import nz.amldock.user.TokenState;
import nz.amldock.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Each user's current {@link TokenState}, for {@link JwtAuthenticationFilter} to check every
 * access token against (security scan F6).
 *
 * <p>Cached for a few seconds, because Postgres is the platform's bottleneck (see perf/reports)
 * and a lookup per request would add up at load. One primary-key read per active user per TTL is
 * negligible. The instance that changes a user evicts at once; other instances catch up within
 * the TTL, instead of the access token's fifteen minutes.
 */
@Component
public class TokenStateCache {

    /** Marks "no such user" in the map, so a deleted user's stale token doesn't hit the DB each time. */
    private static final TokenState MISSING = new TokenState(Integer.MIN_VALUE, false);

    private record Entry(TokenState state, long loadedAt) {}

    private final UserRepository users;
    private final long ttlMillis;
    private final LongSupplier clock;
    private final ConcurrentHashMap<Long, Entry> entries = new ConcurrentHashMap<>();

    @Autowired // two constructors: tell Spring which one is for it (the other is for tests)
    public TokenStateCache(UserRepository users,
                           @Value("${TOKEN_STATE_TTL_SECONDS:30}") long ttlSeconds) {
        this(users, Duration.ofSeconds(ttlSeconds), System::currentTimeMillis);
    }

    TokenStateCache(UserRepository users, Duration ttl, LongSupplier clock) {
        this.users = users;
        this.ttlMillis = ttl.toMillis();
        this.clock = clock;
    }

    /** The user's state, or empty if the user no longer exists. */
    public Optional<TokenState> get(Long userId) {
        long now = clock.getAsLong();
        Entry e = entries.get(userId);
        if (e == null || now - e.loadedAt() >= ttlMillis) {
            TokenState loaded = users.findTokenState(userId).orElse(MISSING);
            e = new Entry(loaded, now);
            entries.put(userId, e);
        }
        return e.state() == MISSING ? Optional.empty() : Optional.of(e.state());
    }

    /**
     * Forget a user once the current transaction commits, so the next request reads the new
     * version. Evicting before the commit would let a concurrent request re-cache the old row.
     */
    public void evictAfterCommit(Long userId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    entries.remove(userId);
                }
            });
        } else {
            entries.remove(userId);
        }
    }
}
