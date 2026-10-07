package nz.amldock.common.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.PGStatement;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.util.function.LongSupplier;

/**
 * Asks a trigram index how common a search term is, so a list query can pick its shape per
 * request: look a rare term's matches up through the index (cost: the matches), or walk the
 * caller's scope testing each row (cost: up to the scope, but a common term fills the page and
 * the count cap within a few rows).
 *
 * <p>This is decided here rather than by the planner because a bound {@code :q} gets generic
 * prepared plans that cannot see how selective the term is
 * (perf/reports/2026-10-06-scale-500k.md, "big firms").
 *
 * <p>The probe itself must not fall into that trap either. The driver server-prepares a statement
 * after a few executions, and Postgres may then switch to a generic plan: for a common name that
 * plan built a GIN bitmap of 187k candidates (87-138 ms) where the plan made with the term seq
 * scans and stops at the cap (9 ms). So probes run unprepared (prepare threshold 0, the unnamed
 * statement), which Postgres always plans with the actual term.
 */
@Component
public class SearchProbe {

    /** At most this many matches are counted per probe. */
    public static final int CAP = PageRequests.COUNT_CAP;

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    public SearchProbe(NamedParameterJdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * True when {@code matchFromWhere} (a {@code FROM ... WHERE ...} using {@code :q}) has fewer
     * than {@code cap} rows. Asks the planner first ({@link #decide}); counts only when its estimate
     * is too close to the cap to trust.
     */
    public boolean fewerThan(String matchFromWhere, String pattern, long cap) {
        if (cap <= 0) return true;
        double estimate = estimate("SELECT 1 " + matchFromWhere, pattern);
        return decide(estimate, cap, () -> count(matchFromWhere, pattern, cap));
    }

    /**
     * Clearly under or over the cap (by 4x either way) is decided on the planner's estimate alone.
     * Only the band in between is counted, and a term there has at most a few thousand candidates,
     * so its index bitmap is small. Counting every term was the costliest statement in the stress
     * run: for "Aroha" and "Patel" Postgres built a GIN bitmap of all ~50k matches before LIMIT
     * could stop it (114-270 ms), where the estimate (44k and 62k) settles it while planning.
     */
    static boolean decide(double estimate, long cap, LongSupplier count) {
        if (estimate < cap / 4.0) return true;
        if (estimate > cap * 4.0) return false;
        return count.getAsLong() < cap;
    }

    /** The planner's row estimate for {@code sql}, planned with the actual term. */
    private double estimate(String sql, String pattern) {
        String plan = run("EXPLAIN (FORMAT JSON) " + sql, pattern, rs -> rs.next() ? rs.getString(1) : null);
        try {
            return json.readTree(plan).path(0).path("Plan").path("Plan Rows").asDouble(Double.MAX_VALUE);
        } catch (Exception e) {
            return Double.MAX_VALUE;   // unreadable: treat as common, the shape that is never pathological
        }
    }

    /** Matches up to {@code cap}. The cap is our own number, inlined so the plan is made knowing it. */
    private long count(String matchFromWhere, String pattern, long cap) {
        Long n = run("SELECT count(*) FROM (SELECT 1 " + matchFromWhere + " LIMIT " + cap + ") probe", pattern,
                rs -> rs.next() ? rs.getLong(1) : 0L);
        return n == null ? 0 : n;
    }

    /** Runs {@code sql} with every {@code :q} bound to the term, as an unprepared statement. */
    private <T> T run(String sql, String pattern, ResultSetExtractor<T> extract) {
        String[] parts = sql.split(":q\\b", -1);
        return jdbc.getJdbcTemplate().query(con -> {
            PreparedStatement ps = con.prepareStatement(String.join("?", parts));
            ps.unwrap(PGStatement.class).setPrepareThreshold(0);
            for (int i = 1; i < parts.length; i++) ps.setString(i, pattern);
            return ps;
        }, extract);
    }
}
