package nz.amldock.deal.assurance;

import nz.amldock.common.web.PageRequests;
import nz.amldock.deal.DealListQuery;
import nz.amldock.deal.DealScope;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * The assurance register, paged in SQL: each VERIFIED or CLOSED deal in scope with its latest
 * version only. Replaces building the full deals list once per status and loading every version
 * of every deal to show one page.
 *
 * <p>The latest version's facts are read off the deal (V57 projections).
 */
@Repository
public class AssuranceQuery {

    /** Filter on the latest version's verdict. AWAITING = signed off, not yet reviewed. */
    public enum Verdict { AWAITING, ASSURED, ACTION_REQUIRED }

    /**
     * @param from inclusive; a deal is in range if its latest version was verified, or the deal
     *             was closed, within [from, to]. Either bound may be null for an open range.
     * @param q    contains-match on the property address
     */
    public record Filter(Long firmId, Long branchId, Instant from, Instant to, String q, Verdict verdict) {}

    /** One register row: the deal and its latest version (null when it has none). */
    public record Row(long dealId, Long versionId) {}

    /** @param exact false when {@code total} is the {@link PageRequests#COUNT_CAP} floor */
    public record RowPage(List<Row> rows, long total, boolean exact) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final DealListQuery deals;

    public AssuranceQuery(NamedParameterJdbcTemplate jdbc, DealListQuery deals) {
        this.jdbc = jdbc;
        this.deals = deals;
    }

    public RowPage page(DealScope scope, Filter f, PageRequests paging) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        // The latest version's facts live on the deal itself (latest_version_id, latest_verified_at,
        // latest_assurance_status, last_closed_at), kept current by triggers (V57). So the
        // register reads straight off idx_deal_assurable[_branch] in display order and stops
        // after the page, instead of looking up the latest version of every assurable deal in the
        // firm first (~600 ms at 25k deals per firm).
        StringBuilder sql = new StringBuilder()
                .append(" FROM deal d")
                .append(" WHERE d.status IN ('VERIFIED', 'CLOSED')");
        scope.appendWhere(sql, params, "d");
        deals.appendSearch(sql, params, f.q(), scope);

        boolean ranged = f.from() != null || f.to() != null;
        if (ranged) {
            if (f.from() != null) params.addValue("from", OffsetDateTime.ofInstant(f.from(), ZoneOffset.UTC));
            if (f.to() != null) params.addValue("to", OffsetDateTime.ofInstant(f.to(), ZoneOffset.UTC));
            // Closing happens to the version the deal stands on, so a close in range brings in the
            // latest version; a deal with no version at all has nothing to show for the range.
            sql.append(" AND d.latest_version_id IS NOT NULL AND (").append(inRange("d.latest_verified_at", f))
               .append(" OR (d.status = 'CLOSED' AND ").append(inRange("d.last_closed_at", f)).append("))");
        }
        if (f.verdict() != null) {
            switch (f.verdict()) {
                case AWAITING -> sql.append(" AND d.latest_version_id IS NOT NULL AND d.latest_assurance_status IS NULL");
                case ASSURED, ACTION_REQUIRED -> {
                    sql.append(" AND d.latest_assurance_status = :verdict");
                    params.addValue("verdict", f.verdict().name());
                }
            }
        }

        long total = jdbc.queryForObject(PageRequests.cappedCountSql(sql.toString()), params, Long.class);
        boolean exact = total <= PageRequests.COUNT_CAP;
        if (total == 0 || (exact && paging.offset() >= total)) return new RowPage(List.of(), total, exact);
        params.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Row> rows = jdbc.query("SELECT d.id AS deal_id, d.latest_version_id AS version_id" + sql
                        + " ORDER BY d.latest_verified_at DESC NULLS LAST, d.id DESC LIMIT :limit OFFSET :offset",
                params, (rs, i) -> new Row(rs.getLong("deal_id"), (Long) rs.getObject("version_id", Long.class)));
        return new RowPage(rows, total, exact);
    }

    /** Inclusive at both ends, either end optional; matches the old in-memory {@code within}. */
    private static String inRange(String column, Filter f) {
        if (f.from() != null && f.to() != null) return "(" + column + " BETWEEN :from AND :to)";
        if (f.from() != null) return "(" + column + " >= :from)";
        return "(" + column + " <= :to)";
    }
}
