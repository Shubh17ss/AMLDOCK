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

    /**
     * Totals are exact up to this many rows; beyond it a list reports "more than 1,000" instead of
     * counting every row. An exact count visits every matching row, so it grows with the data
     * however good the indexes are: the owners count took 109 ms at 25k deals per firm, the capped
     * one 4 ms (perf/reports/2026-10-06-scale-500k.md).
     */
    public static final int COUNT_CAP = 1000;

    /** {@code SELECT count(*)} over at most {@code COUNT_CAP + 1} rows of {@code fromWhere}. */
    public static String cappedCountSql(String fromWhere) {
        return "SELECT count(*) FROM (SELECT 1" + fromWhere + " LIMIT " + (COUNT_CAP + 1) + ") capped";
    }

    /**
     * The property address as searched, over table alias {@code p}: the four address parts joined
     * with ", ". Plain concatenation, not concat_ws, because an index expression must be IMMUTABLE
     * and concat_ws is only STABLE; perf/sql/gin-indexes.sql indexes exactly this expression, so
     * the two must stay identical.
     */
    public static final String ADDRESS_SEARCH_SQL =
            "(coalesce(p.address_line1, '') || ', ' || coalesce(p.suburb, '') || ', '"
                    + " || coalesce(p.district, '') || ', ' || coalesce(p.region, ''))";

    /** Shorter search text is ignored (no filter), see {@link #containsPattern}. */
    public static final int MIN_SEARCH_LENGTH = 3;

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
     * search for "50%" means the text, not a pattern. Null when there is nothing to search for,
     * including fewer than {@link #MIN_SEARCH_LENGTH} characters: a trigram index needs three to
     * match on, and debounced searches fire on partial words. Pair with {@code ILIKE :q} followed
     * by {@link #LIKE_ESCAPE}.
     */
    public static String containsPattern(String q) {
        if (q == null || q.trim().length() < MIN_SEARCH_LENGTH) return null;
        String escaped = q.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
