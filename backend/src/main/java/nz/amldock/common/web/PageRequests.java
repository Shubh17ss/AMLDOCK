package nz.amldock.common.web;

/**
 * A clamped page request for list endpoints that page in SQL.
 *
 * <p>Every list the UI shows is bounded by {@link #MAX_SIZE}, whatever the caller asks for: the
 * 50k-deal baseline (perf/reports/2026-10-05-baseline-50k.md) showed unbounded lists turning a
 * single request into thousands of rows of entity mapping, and that is the failure this exists to
 * rule out. The same clamp {@code AuditService.search} applies, with a lower ceiling.
 */
public record PageRequests(int page, int size) {

    public static final int DEFAULT_SIZE = 25;
    public static final int MAX_SIZE = 100;

    /** Appended after {@code ILIKE :param}: backslash is the escape character in the pattern. */
    public static final String LIKE_ESCAPE = " ESCAPE '\\'";

    public static PageRequests of(Integer page, Integer size) {
        int p = page == null ? 0 : Math.max(page, 0);
        int s = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
        return new PageRequests(p, s);
    }

    public long offset() {
        return (long) page * size;
    }

    /**
     * {@code %q%} for a case-insensitive contains match, with LIKE's own wildcards escaped so a
     * search for "50%" means the text, not a pattern. Null when there is nothing to search for.
     * Pair with {@code ILIKE :q} followed by {@link #LIKE_ESCAPE}.
     */
    public static String containsPattern(String q) {
        if (q == null || q.isBlank()) return null;
        String escaped = q.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
