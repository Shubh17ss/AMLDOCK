package nz.amldock.deal;

import nz.amldock.common.web.IdPage;
import nz.amldock.common.web.PageRequests;
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

    public DealListQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public IdPage page(DealScope scope, List<DealStatus> statuses, String q, Sort sort, PageRequests paging) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        scope.appendWhere(where, params, "d");
        if (statuses != null && !statuses.isEmpty()) {
            where.append(" AND d.status IN (:statuses)");
            params.addValue("statuses", statuses.stream().map(Enum::name).toList());
        }
        appendSearch(where, params, q);

        long total = jdbc.queryForObject("SELECT count(*) FROM deal d" + where, params, Long.class);
        if (total == 0 || paging.offset() >= total) return new IdPage(List.of(), total);

        params.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Long> ids = jdbc.queryForList(
                "SELECT d.id FROM deal d" + where
                        + " ORDER BY " + sort.column + " DESC, d.id DESC LIMIT :limit OFFSET :offset",
                params, Long.class);
        return new IdPage(ids, total);
    }

    /**
     * Reference, client name or property address contains the text. The same fields the list
     * pages searched client-side before the list was paged.
     *
     * <p>Each field is matched in its own sub-select rather than as one OR across the joined
     * tables. A cross-table OR forces Postgres to join everything and test every row; separate
     * sub-selects let each use its own trigram index where one exists
     * (perf/reports/2026-10-06-gin-indexes.md), and are just as correct where none does.
     */
    public static void appendSearch(StringBuilder where, MapSqlParameterSource params, String q) {
        String pattern = PageRequests.containsPattern(q);
        if (pattern == null) return;
        where.append(" AND (d.id IN (SELECT dr.id FROM deal dr WHERE dr.reference ILIKE :q")
             .append(PageRequests.LIKE_ESCAPE).append(")")
             .append(" OR d.client_id IN (SELECT c.id FROM client c WHERE c.display_name ILIKE :q")
             .append(PageRequests.LIKE_ESCAPE).append(")")
             .append(" OR d.property_id IN (SELECT p.id FROM property p WHERE ")
             .append(PageRequests.ADDRESS_SEARCH_SQL).append(" ILIKE :q")
             .append(PageRequests.LIKE_ESCAPE).append("))");
        params.addValue("q", pattern);
    }

    /** Per-status aggregates for the dashboards, over everything in scope. */
    public DealSummaryDto summary(DealScope scope, Instant updatedSince) {
        MapSqlParameterSource params = new MapSqlParameterSource("since", OffsetDateTime.ofInstant(updatedSince, java.time.ZoneOffset.UTC));
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        scope.appendWhere(where, params, "d");

        Map<DealStatus, DealSummaryDto.StatusSummary> byStatus = new EnumMap<>(DealStatus.class);
        jdbc.query("SELECT d.status, count(*) AS n,"
                        + " coalesce(sum(coalesce(d.valuation_max, d.transaction_value)), 0) AS value_sum,"
                        + " min(d.created_at) AS oldest,"
                        + " count(*) FILTER (WHERE d.updated_at >= :since) AS recent"
                        + " FROM deal d" + where + " GROUP BY d.status",
                params, rs -> {
                    OffsetDateTime oldest = rs.getObject("oldest", OffsetDateTime.class);
                    byStatus.put(DealStatus.valueOf(rs.getString("status")), new DealSummaryDto.StatusSummary(
                            rs.getLong("n"),
                            rs.getBigDecimal("value_sum") == null ? BigDecimal.ZERO : rs.getBigDecimal("value_sum"),
                            oldest == null ? null : oldest.toInstant(),
                            rs.getLong("recent")));
                });
        long total = byStatus.values().stream().mapToLong(DealSummaryDto.StatusSummary::count).sum();

        Long firms = jdbc.queryForObject("SELECT count(DISTINCT fb.real_estate_firm_id) FROM deal d"
                        + " JOIN firm_branch fb ON fb.id = d.firm_branch_id" + where
                        + " AND d.status = 'REVIEW'",
                params, Long.class);
        return new DealSummaryDto(total, byStatus, firms == null ? 0 : firms);
    }
}
