package nz.amldock.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-IP throttle on the public sign-in endpoints (security scan F5).
 *
 * <p>{@code /otp/request} now answers the same way for every email, so this is what stops one
 * client from mass-probing addresses, flooding inboxes or guessing codes across many accounts. The
 * answer is the same 429 whatever email was sent, so it is no oracle itself.
 *
 * <p>A fixed one-minute window per {@code getRemoteAddr()}, which {@code TrustedProxyConfig} has
 * already resolved to the real client behind a trusted proxy. In memory and per instance: a
 * throttle, not an exact quota. Paths are the decoded servlet path, matched exactly.
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    static final Set<String> LIMITED_PATHS = Set.of(
            "/api/auth/otp/request", "/api/auth/otp/verify",
            "/api/auth/admin/login", "/api/auth/admin/verify");

    private static final long WINDOW_MILLIS = 60_000;

    private final int limitPerMinute;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    private record Window(long startedAt, AtomicInteger count) {}

    public LoginRateLimitFilter(@Value("${LOGIN_RATE_LIMIT_PER_MINUTE:20}") int limitPerMinute) {
        this.limitPerMinute = limitPerMinute;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if ("POST".equals(request.getMethod())
                && LIMITED_PATHS.contains(request.getServletPath())
                && !tryAcquire(request.getRemoteAddr(), System.currentTimeMillis())) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            // Fixed text only, so nothing here needs escaping. Same shape as ApiError.
            response.getWriter().write("{\"timestamp\":\"" + Instant.now()
                    + "\",\"status\":429,\"error\":\"Too Many Requests\","
                    + "\"message\":\"Too many sign-in attempts — wait a minute and try again\","
                    + "\"fieldErrors\":[]}");
            return;
        }
        chain.doFilter(request, response);
    }

    boolean tryAcquire(String ip, long now) {
        Window w = windows.compute(ip == null ? "unknown" : ip, (k, cur) ->
                cur == null || now - cur.startedAt() >= WINDOW_MILLIS
                        ? new Window(now, new AtomicInteger())
                        : cur);
        return w.count().incrementAndGet() <= limitPerMinute;
    }

    /** Drops finished windows so the map holds only clients seen in the last minute. */
    @Scheduled(fixedDelay = WINDOW_MILLIS)
    void sweep() {
        long now = System.currentTimeMillis();
        windows.values().removeIf(w -> now - w.startedAt() >= WINDOW_MILLIS);
    }
}
