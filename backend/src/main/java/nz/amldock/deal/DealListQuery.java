package nz.amldock.deal;

import nz.amldock.common.web.IdPage;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.SearchProbe;
import nz.amldock.deal.dto.DealSummaryDto;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * The deals list and the dashboard summary, paged and aggregated in SQL.
 *
 * <p>Returns ids, not entities: the caller loads and maps only the page. Filtering, search and
 * ordering all happen here so that a request's cost is bounded by the page size, not by how many
 * deals the caller's firm has.
 */
@Repository
public class DealListQuery {

    public enum Sort {
        CREATED_AT("d.created_at"), UPDATED_AT("d.updated_at");

        final String column;

        Sort(String column) {
            this.column = column;
        }
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final SearchProbe probe;

    public DealListQuery(NamedParameterJdbcTemplate jdbc, SearchProbe probe) {
        this.jdbc = jdbc;
        this.probe = probe;
    }

    public IdPage page(DealScope scope, List<DealStatus> statuses, String q, Sort sort, PageRequests paging) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        scope.appendWhere(where, params, "d");
        if (statuses != null && !statuses.isEmpty()) {
            where.append(" AND d.status IN (:statuses)");
            params.addValue("statuses", statuses.stream().map(Enum::name).toList());
        }
        appendSearch(where, params, q, scope);

        long total = jdbc.queryForObject(PageRequests.cappedCountSql(" FROM deal d" + where), params, Long.class);
        boolean exact = total <= PageRequests.COUNT_CAP;
        if (total == 0 || (exact && paging.offset() >= total)) return new IdPage(List.of(), total, exact);

        params.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Long> ids = jdbc.queryForList(
                "SELECT d.id FROM deal d" + where
                        + " ORDER BY " + sort.column + " DESC, d.id DESC LIMIT :limit OFFSET :offset",
                params, Long.class);
        return new IdPage(ids, total, exact);
    }

    private static final String ADDRESS_MATCH =
            PageRequests.ADDRESS_SEARCH_SQL + " ILIKE :q" + PageRequests.LIKE_ESCAPE;

    /**
     * The property address contains the text. Address only: about 90% of deal searches are by
     * address, and dropping the reference and client arms removes the OR that kept every arm
     * from using its index.
     *
     * <p>Two shapes, chosen per request because which is cheap depends on how common the term is,
     * which the database cannot see through a bound {@code :q} in a generic prepared plan:
     * <ul>
     *   <li><b>Index form</b>: {@code d.property_id IN (matching properties)}. The address trigram
     *       index finds the matches, {@code idx_deal_property} (V58) maps them to deals, and the
     *       scope filters those. Costs the number of matches on the platform.</li>
     *   <li><b>Scope form</b>: walk the scope's deals in display order, testing each address. A
     *       common term fills the page and reaches the count cap after a few rows. Costs up to the
     *       scope's size.</li>
     * </ul>
     * A platform-wide search always uses the index form. A narrow scope probes the index first:
     * fewer matches than {@link SearchProbe#CAP} and than the scope's deals means the index form,
     * otherwise the scope form. Cost is then roughly min(matches, scope size)
     * (perf/reports/2026-10-06-scale-500k.md, "big firms").
     */
    public void appendSearch(StringBuilder where, MapSqlParameterSource params, String q, DealScope scope) {
        String pattern = PageRequests.containsPattern(q);
        if (pattern == null) return;
        params.addValue("q", pattern);
        if (scope.isNarrow() && !fewMatches(scope, pattern)) {
            where.append(" AND EXISTS (SELECT 1 FROM property p WHERE p.id = d.property_id AND ")
                 .append(ADDRESS_MATCH).append(")");
        } else {
            where.append(" AND d.property_id IN (SELECT p.id FROM property p WHERE ")
                 .append(ADDRESS_MATCH).append(")");
        }
    }

    /**
     * True when fewer properties match the term than the scope has deals, up to
     * {@link SearchProbe#CAP}. An agent's own deals are few, so their scope is always walked.
     * Other scopes are sized from the per-branch counters in {@code deal_status_summary} (V57).
     */
    private boolean fewMatches(DealScope scope, String pattern) {
        if (scope.creatorId() != null) return false;
        MapSqlParameterSource sizeParams = new MapSqlParameterSource();
        StringBuilder sizeWhere = new StringBuilder(" WHERE 1 = 1");
        scope.appendWhere(sizeWhere, sizeParams, "s");
        Long scopeSize = jdbc.queryForObject(
                "SELECT coalesce(sum(s.deal_count), 0) FROM deal_status_summary s" + sizeWhere, sizeParams, Long.class);
        return probe.fewerThan("FROM property p WHERE " + ADDRESS_MATCH,
                pattern, Math.min(scopeSize == null ? 0 : scopeSize, SearchProbe.CAP));
    }

    /**
     * Per-status aggregates for the dashboards, over everything in scope.
     *
     * <p>Branch, firm and platform scopes read the per-branch counters in {@code
     * deal_status_summary} (V57, kept by a trigger on deal), so the cost tracks the number of
     * branches, not deals. The oldest deal and the 30-day count come from per-branch index lookups
     * (min off {@code idx_deal_branch_status_created}, a recent range off
     * {@code idx_deal_branch_status_updated}). An agent's own deals are few, so their summary is
     * a plain GROUP BY.
     */
    public DealSummaryDto summary(DealScope scope, Instant updatedSince) {
        MapSqlParameterSource params = new MapSqlParameterSource("since", OffsetDateTime.ofInstant(updatedSince, java.time.ZoneOffset.UTC));
        Map<DealStatus, DealSummaryDto.StatusSummary> byStatus = new EnumMap<>(DealStatus.class);
        org.springframework.jdbc.core.RowCallbackHandler collect = rs -> {
            OffsetDateTime oldest = rs.getObject("oldest", OffsetDateTime.class);
            byStatus.put(DealStatus.valueOf(rs.getString("status")), new DealSummaryDto.StatusSummary(
                    rs.getLong("n"),
                    rs.getBigDecimal("value_sum") == null ? BigDecimal.ZERO : rs.getBigDecimal("value_sum"),
                    oldest == null ? null : oldest.toInstant(),
                    rs.getLong("recent")));
        };
        Long firms;

        if (scope.creatorId() != null) {
            StringBuilder where = new StringBuilder(" WHERE 1 = 1");
            scope.appendWhere(where, params, "d");
            jdbc.query("SELECT d.status, count(*) AS n,"
                            + " coalesce(sum(coalesce(d.valuation_max, d.transaction_value)), 0) AS value_sum,"
                            + " min(d.created_at) AS oldest,"
                            + " count(*) FILTER (WHERE d.updated_at >= :since) AS recent"
                            + " FROM deal d" + where + " GROUP BY d.status",
                    params, collect);
            firms = jdbc.queryForObject("SELECT count(DISTINCT fb.real_estate_firm_id) FROM deal d"
                            + " JOIN firm_branch fb ON fb.id = d.firm_branch_id" + where
                            + " AND d.status = 'REVIEW'",
                    params, Long.class);
        } else {
            StringBuilder where = new StringBuilder(" WHERE s.deal_count > 0");
            scope.appendWhere(where, params, "s");
            jdbc.query("SELECT s.status, sum(s.deal_count) AS n, sum(s.value_sum) AS value_sum,"
                            + " min(o.created_at) AS oldest, coalesce(sum(r.recent), 0) AS recent"
                            + " FROM deal_status_summary s"
                            + " LEFT JOIN LATERAL (SELECT d.created_at FROM deal d WHERE d.firm_branch_id = s.firm_branch_id"
                            + "   AND d.status = s.status ORDER BY d.created_at LIMIT 1) o ON true"
                            + " LEFT JOIN LATERAL (SELECT count(*) AS recent FROM deal d WHERE d.firm_branch_id = s.firm_branch_id"
                            + "   AND d.status = s.status AND d.updated_at >= :since) r ON true"
                            + where + " GROUP BY s.status",
                    params, collect);
            firms = jdbc.queryForObject("SELECT count(DISTINCT fb.real_estate_firm_id) FROM deal_status_summary s"
                            + " JOIN firm_branch fb ON fb.id = s.firm_branch_id" + where + " AND s.status = 'REVIEW'",
                    params, Long.class);
        }
        long total = byStatus.values().stream().mapToLong(DealSummaryDto.StatusSummary::count).sum();
        return new DealSummaryDto(total, byStatus, firms == null ? 0 : firms);
    }
}
