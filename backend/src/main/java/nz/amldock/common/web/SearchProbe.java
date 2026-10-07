package nz.amldock.common.web;

import org.postgresql.PGStatement;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;

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

    /** At most this many matches are fetched per probe. */
    public static final int CAP = PageRequests.COUNT_CAP;

    private final NamedParameterJdbcTemplate jdbc;

    public SearchProbe(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * True when {@code matchFromWhere} (a {@code FROM ... WHERE ...} using {@code :q}) has fewer
     * than {@code cap} rows. The cap is our own number, inlined so the plan is made knowing it;
     * the term stays bound.
     */
    public boolean fewerThan(String matchFromWhere, String pattern, long cap) {
        if (cap <= 0) return true;
        String[] parts = ("SELECT count(*) FROM (SELECT 1 " + matchFromWhere + " LIMIT " + cap + ") probe").split(":q\\b", -1);
        Long matches = jdbc.getJdbcTemplate().query(con -> {
            PreparedStatement ps = con.prepareStatement(String.join("?", parts));
            ps.unwrap(PGStatement.class).setPrepareThreshold(0);
            for (int i = 1; i < parts.length; i++) ps.setString(i, pattern);
            return ps;
        }, rs -> rs.next() ? rs.getLong(1) : 0L);
        return matches != null && matches < cap;
    }
}
