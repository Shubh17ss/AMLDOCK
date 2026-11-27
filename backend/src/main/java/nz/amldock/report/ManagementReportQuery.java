package nz.amldock.report;

import nz.amldock.deal.DealStatus;
import nz.amldock.deal.RiskRating;
import nz.amldock.deal.assurance.AssuranceStatus;
import nz.amldock.ownership.NodeType;
import nz.amldock.property.PropertyType;
import nz.amldock.report.dto.OwnerTypeReportDto;
import nz.amldock.report.dto.PropertyTypeReportDto;
import nz.amldock.report.dto.ReportOverviewDto;
import nz.amldock.report.dto.TrainingReportDto;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * The management report's aggregates, each one pass of hand-written SQL over one firm's rows.
 *
 * <p>Live rather than pre-aggregated: every query is bounded by one firm (the perf dataset's
 * largest is 25k deals) and served by the indexes the registers already use. A report window can
 * be any span of days, which a materialized view could only serve by being pre-aggregated per day,
 * so that cost is only worth paying once measurements say so.
 *
 * <p>Deal scope is {@link nz.amldock.deal.DealScope}, the same rule as every deal list. The owner
 * and training queries also filter on the firm directly; the service has already checked that the
 * branch belongs to it.
 */
@Repository
class ManagementReportQuery {

    static final String NOT_ASSESSED = "NOT_ASSESSED";
    static final String AWAITING = "AWAITING";
    static final String NOT_SET = "NOT_SET";

    /**
     * Long enough for the largest firm's all-time report several times over (tens of ms when
     * measured), short enough that a pathological plan gives its pool connection back rather than
     * holding it while users wait behind it.
     */
    private static final String STATEMENT_TIMEOUT = "SET LOCAL statement_timeout = '10s'";

    private final NamedParameterJdbcTemplate jdbc;

    ManagementReportQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Applies to the rest of the current transaction only (SET LOCAL), so it needs one. */
    void limitStatementTime() {
        jdbc.getJdbcTemplate().execute(STATEMENT_TIMEOUT);
    }

    // ── Overview ────────────────────────────────────────────────────────────

    ReportOverviewDto overview(ReportScope scope) {
        ReportWindow w = scope.window();
        MapSqlParameterSource params = new MapSqlParameterSource();
        bindWindow(params, w);
        // One small cube (at most 5 statuses x 4 ratings x 4 verdicts) folded into the three maps
        // below, instead of three passes over the same deals.
        StringBuilder sql = new StringBuilder()
                .append("SELECT d.status AS status, d.risk_rating AS risk,")
                // Same rule as the assurance register: only a signed-off deal has a version to
                // assure, and the latest_* projections outlive a reopen, so the status is tested too.
                .append(" CASE WHEN d.status IN ('VERIFIED', 'CLOSED') AND d.latest_version_id IS NOT NULL")
                .append(" THEN coalesce(d.latest_assurance_status, '").append(AWAITING).append("') END AS assurance,")
                .append(" count(*) AS n")
                .append(" FROM deal d")
                .append(" WHERE ").append(within("d.created_at", w));
        scope.deals().appendWhere(sql, params, "d");
        sql.append(" GROUP BY 1, 2, 3");

        Map<String, Long> byStatus = zeros(names(DealStatus.values()));
        Map<String, Long> byRisk = zeros(append(names(RiskRating.values()), NOT_ASSESSED));
        Map<String, Long> byAssurance = zeros(append(names(AssuranceStatus.values()), AWAITING));
        jdbc.query(sql.toString(), params, (RowCallbackHandler) rs -> {
            long n = rs.getLong("n");
            String risk = rs.getString("risk");
            String assurance = rs.getString("assurance");
            byStatus.merge(rs.getString("status"), n, Long::sum);
            byRisk.merge(risk == null ? NOT_ASSESSED : risk, n, Long::sum);
            if (assurance != null) byAssurance.merge(assurance, n, Long::sum);
        });

        long created = byStatus.values().stream().mapToLong(Long::longValue).sum();
        long open = byStatus.get(DealStatus.NEW.name()) + byStatus.get(DealStatus.REVIEW.name())
                + byStatus.get(DealStatus.ON_HOLD.name());
        long signedOff = byStatus.get(DealStatus.VERIFIED.name()) + byStatus.get(DealStatus.CLOSED.name());
        return new ReportOverviewDto(created, open, signedOff,
                byRisk.get(RiskRating.HIGH.name()),
                byAssurance.get(AssuranceStatus.ACTION_REQUIRED.name()),
                byStatus, byRisk, byAssurance);
    }

    // ── Deals by property type ──────────────────────────────────────────────

    PropertyTypeReportDto propertyTypes(ReportScope scope) {
        ReportWindow w = scope.window();
        MapSqlParameterSource params = new MapSqlParameterSource();
        bindWindow(params, w);
        String closedInWindow = "d.status = 'CLOSED' AND " + within("d.last_closed_at", w);
        StringBuilder sql = new StringBuilder()
                .append("SELECT p.property_type AS type, GROUPING(p.property_type) AS is_total,")
                .append(" count(*) FILTER (WHERE ").append(within("d.created_at", w)).append(") AS created,")
                // decided_at is the current sign-off: set on VERIFY, kept through CLOSE, cleared
                // on any move back. So a deal reopened since does not count as verified.
                .append(" count(*) FILTER (WHERE d.status IN ('VERIFIED', 'CLOSED') AND ")
                .append(within("d.decided_at", w)).append(") AS verified,")
                .append(" count(*) FILTER (WHERE ").append(closedInWindow).append(") AS closed,")
                .append(" count(*) FILTER (WHERE d.status IN ('VERIFIED', 'CLOSED')) AS verified_all,")
                .append(" count(*) FILTER (WHERE d.status IN ('NEW', 'REVIEW', 'ON_HOLD')) AS unverified_all,")
                .append(" count(sale.price) AS sold,")
                .append(" round(avg(sale.price), 2) AS avg_sale,")
                .append(" max(sale.price) AS max_sale")
                .append(" FROM deal d")
                .append(" JOIN property p ON p.id = d.property_id")
                // A development is sold as units, each with its own price, and keeps no single
                // sale_price. The unit lookup sits inside the CASE, so it only runs for deals
                // actually closed in the window.
                .append(" CROSS JOIN LATERAL (SELECT CASE WHEN ").append(closedInWindow).append(" AND d.property_sold")
                .append(" THEN coalesce(d.sale_price,")
                .append(" (SELECT sum(u.sale_price) FROM deal_sale_unit u WHERE u.deal_id = d.id))")
                .append(" END AS price) sale")
                .append(" WHERE TRUE");
        scope.deals().appendWhere(sql, params, "d");
        sql.append(" GROUP BY GROUPING SETS ((p.property_type), ())");

        Map<String, PropertyTypeReportDto.Row> byType = new LinkedHashMap<>();
        PropertyTypeReportDto.Row[] total = new PropertyTypeReportDto.Row[1];
        jdbc.query(sql.toString(), params, (RowCallbackHandler) rs -> {
            boolean isTotal = rs.getInt("is_total") == 1;
            String type = isTotal ? null : nullToNotSet(rs.getString("type"));
            PropertyTypeReportDto.Row row = new PropertyTypeReportDto.Row(type,
                    rs.getLong("created"), 0, rs.getLong("verified"), rs.getLong("closed"),
                    rs.getLong("verified_all"), rs.getLong("unverified_all"), rs.getLong("sold"),
                    rs.getBigDecimal("avg_sale"), rs.getBigDecimal("max_sale"));
            if (isTotal) total[0] = row;
            else byType.put(type, row);
        });

        PropertyTypeReportDto.Row sum = total[0] != null ? total[0]
                : new PropertyTypeReportDto.Row(null, 0, 0, 0, 0, 0, 0, 0, null, null);
        // Every known type, in the form's order, so the table keeps its shape when a type has no
        // deals. Then "not set", and anything the column holds that the enum no longer names (the
        // column has no CHECK constraint), so no deal drops out of the totals unexplained.
        List<PropertyTypeReportDto.Row> rows = new ArrayList<>();
        for (PropertyType t : PropertyType.values()) {
            PropertyTypeReportDto.Row r = byType.remove(t.name());
            rows.add(withPercent(r != null ? r
                    : new PropertyTypeReportDto.Row(t.name(), 0, 0, 0, 0, 0, 0, 0, null, null), sum.created()));
        }
        PropertyTypeReportDto.Row notSet = byType.remove(NOT_SET);
        new TreeMap<>(byType).values().forEach(r -> rows.add(withPercent(r, sum.created())));
        if (notSet != null) rows.add(withPercent(notSet, sum.created()));
        return new PropertyTypeReportDto(rows, withPercent(sum, sum.created()));
    }

    private static PropertyTypeReportDto.Row withPercent(PropertyTypeReportDto.Row r, long totalCreated) {
        double pct = totalCreated == 0 ? 0 : Math.round(r.created() * 1000.0 / totalCreated) / 10.0;
        return new PropertyTypeReportDto.Row(r.propertyType(), r.created(), pct, r.verified(), r.closed(),
                r.verifiedAllTime(), r.unverifiedAllTime(), r.sold(), r.averageSalePrice(), r.maxSalePrice());
    }

    private static String nullToNotSet(String type) {
        return type == null || type.isBlank() ? NOT_SET : type;
    }

    // ── Owners by type ──────────────────────────────────────────────────────

    OwnerTypeReportDto owners(ReportScope scope) {
        ReportWindow w = scope.window();
        MapSqlParameterSource params = new MapSqlParameterSource().addValue("firm", scope.firmId());
        bindWindow(params, w);
        StringBuilder scoped = new StringBuilder("SELECT d.id FROM deal d WHERE ").append(within("d.created_at", w));
        scope.deals().appendWhere(scoped, params, "d");

        String sql = "WITH scoped AS (" + scoped + "),"
                // Every node on those deals, both sides, every type: what the registers list.
                + " owners AS ("
                + "   SELECT n.node_type, n.is_overseas, n.verification_status, n.identity_key"
                + "     FROM ownership_node n"
                + "     JOIN ownership_structure s ON s.id = n.ownership_structure_id"
                + "    WHERE n.real_estate_firm_id = :firm"
                + "      AND s.deal_id IN (SELECT id FROM scoped)"
                + " ),"
                // An owner is re-used when the same identity sits on two or more deals anywhere in
                // the firm, the window notwithstanding: being on an earlier deal is the point.
                // identity_key is shared only by owner-picker copies (V62), so this is a floor.
                + " reused AS ("
                + "   SELECT n2.identity_key"
                + "     FROM ownership_node n2"
                + "     JOIN ownership_structure s2 ON s2.id = n2.ownership_structure_id"
                + "    WHERE n2.real_estate_firm_id = :firm"
                + "      AND n2.identity_key IN (SELECT o.identity_key FROM owners o)"
                + "    GROUP BY n2.identity_key"
                + "   HAVING count(DISTINCT s2.deal_id) > 1"
                + " )"
                + " SELECT o.node_type AS type, GROUPING(o.node_type) AS is_total,"
                + "        count(*) AS owners,"
                // The Overseas Residents Register's own test (IndividualQuery).
                + "        count(*) FILTER (WHERE o.is_overseas) AS overseas,"
                + "        count(DISTINCT o.identity_key) FILTER (WHERE r.identity_key IS NOT NULL) AS reused,"
                // The CDD Exceptions register's own test.
                + "        count(*) FILTER (WHERE o.verification_status = 'VERIFIED_WITH_EXCEPTION') AS exceptions"
                + "   FROM owners o"
                + "   LEFT JOIN reused r ON r.identity_key = o.identity_key"
                + "  GROUP BY GROUPING SETS ((o.node_type), ())";

        Map<String, OwnerTypeReportDto.Row> byType = new LinkedHashMap<>();
        OwnerTypeReportDto.Row[] total = new OwnerTypeReportDto.Row[1];
        jdbc.query(sql, params, (RowCallbackHandler) rs -> {
            boolean isTotal = rs.getInt("is_total") == 1;
            OwnerTypeReportDto.Row row = new OwnerTypeReportDto.Row(isTotal ? null : rs.getString("type"),
                    rs.getLong("owners"), rs.getLong("overseas"), rs.getLong("reused"), rs.getLong("exceptions"));
            if (isTotal) total[0] = row;
            else byType.put(row.ownerType(), row);
        });

        List<OwnerTypeReportDto.Row> rows = new ArrayList<>();
        for (NodeType t : NodeType.values()) {
            OwnerTypeReportDto.Row r = byType.remove(t.name());
            rows.add(r != null ? r : new OwnerTypeReportDto.Row(t.name(), 0, 0, 0, 0));
        }
        rows.addAll(new TreeMap<>(byType).values());
        return new OwnerTypeReportDto(rows,
                total[0] != null ? total[0] : new OwnerTypeReportDto.Row(null, 0, 0, 0, 0));
    }

    // ── Staff training ──────────────────────────────────────────────────────

    TrainingReportDto training(ReportScope scope) {
        ReportWindow w = scope.window();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("firm", scope.firmId())
                .addValue("today", w.today())
                .addValue("toDate", w.to());
        bindWindow(params, w);
        if (w.from() != null) params.addValue("fromDate", w.from());
        if (scope.branchId() != null) params.addValue("branch", scope.branchId());

        String courseScope = " c.real_estate_firm_id = :firm" + (scope.branchId() != null ? " AND c.firm_branch_id = :branch" : "");
        String sessionScope = " s.real_estate_firm_id = :firm" + (scope.branchId() != null ? " AND s.firm_branch_id = :branch" : "");
        String sessionInWindow = "(s.session_date <= :toDate" + (w.from() != null ? " AND s.session_date >= :fromDate" : "") + ")";

        String sql = "WITH courses AS ("
                + "   SELECT a.user_id,"
                + "          count(*) AS assigned,"
                // "Done" is a pass, as on the Staff Training users tab: an attempt that failed
                // leaves the course outstanding.
                + "          count(*) FILTER (WHERE a.passed IS TRUE) AS passed,"
                + "          count(*) FILTER (WHERE a.passed IS NOT TRUE AND c.due_date < :today) AS overdue,"
                + "          count(*) FILTER (WHERE a.passed IS TRUE AND " + within("a.completed_at", w) + ") AS passed_in_window,"
                + "          max(a.completed_at) FILTER (WHERE a.passed IS TRUE) AS last_at"
                + "     FROM training_course_assignee a"
                + "     JOIN training_course c ON c.id = a.training_course_id"
                + "    WHERE" + courseScope
                + "    GROUP BY a.user_id"
                + " ), sessions AS ("
                + "   SELECT t.user_id,"
                + "          count(*) FILTER (WHERE " + sessionInWindow + ") AS assigned,"
                + "          count(*) FILTER (WHERE " + sessionInWindow + " AND t.completed_at IS NOT NULL) AS attended,"
                + "          coalesce(sum(s.total_minutes) FILTER (WHERE " + sessionInWindow
                + "                   AND t.completed_at IS NOT NULL), 0) AS minutes,"
                + "          max(t.completed_at) AS last_at"
                + "     FROM training_session_attendee t"
                + "     JOIN training_session s ON s.id = t.training_session_id"
                + "    WHERE" + sessionScope
                + "    GROUP BY t.user_id"
                + " ), people AS ("
                + "   SELECT user_id FROM courses"
                + "   UNION SELECT user_id FROM sessions WHERE assigned > 0"
                + " )"
                // Role and branch as they stand in this firm: an officer serving two entities has
                // a membership in each, and their account's own fields describe only one.
                + " SELECT u.id AS user_id, u.full_name, coalesce(m.role, u.role) AS role, b.name AS branch_name,"
                + "        coalesce(c.assigned, 0) AS courses_assigned,"
                + "        coalesce(c.passed, 0) AS courses_passed,"
                + "        coalesce(c.overdue, 0) AS courses_overdue,"
                + "        coalesce(c.passed_in_window, 0) AS courses_passed_in_window,"
                + "        coalesce(s.assigned, 0) AS sessions_assigned,"
                + "        coalesce(s.attended, 0) AS sessions_attended,"
                + "        coalesce(s.minutes, 0) AS minutes,"
                + "        greatest(c.last_at, s.last_at) AS last_completed_at"
                + "   FROM people p"
                + "   JOIN app_user u ON u.id = p.user_id"
                + "   LEFT JOIN firm_membership m ON m.app_user_id = u.id AND m.real_estate_firm_id = :firm"
                + "   LEFT JOIN firm_branch b ON b.id = coalesce(m.firm_branch_id, u.firm_branch_id)"
                + "                          AND b.real_estate_firm_id = :firm"
                + "   LEFT JOIN courses c ON c.user_id = p.user_id"
                + "   LEFT JOIN sessions s ON s.user_id = p.user_id"
                + "  ORDER BY lower(u.full_name), u.id";

        long[] passedInWindow = new long[1];
        List<TrainingReportDto.Person> people = jdbc.query(sql, params, (rs, i) -> {
            passedInWindow[0] += rs.getLong("courses_passed_in_window");
            return new TrainingReportDto.Person(rs.getLong("user_id"), rs.getString("full_name"),
                    rs.getString("role"), rs.getString("branch_name"),
                    rs.getLong("courses_assigned"), rs.getLong("courses_passed"), rs.getLong("courses_overdue"),
                    rs.getLong("sessions_assigned"), rs.getLong("sessions_attended"), rs.getLong("minutes"),
                    instant(rs, "last_completed_at"));
        });

        Long held = jdbc.queryForObject(
                "SELECT count(*) FROM training_session s WHERE" + sessionScope + " AND " + sessionInWindow,
                params, Long.class);

        TrainingReportDto.Summary summary = new TrainingReportDto.Summary(
                people.size(),
                people.stream().mapToLong(TrainingReportDto.Person::coursesAssigned).sum(),
                people.stream().mapToLong(TrainingReportDto.Person::coursesPassed).sum(),
                people.stream().mapToLong(TrainingReportDto.Person::coursesOverdue).sum(),
                passedInWindow[0],
                held == null ? 0 : held,
                people.stream().mapToLong(TrainingReportDto.Person::sessionsAssigned).sum(),
                people.stream().mapToLong(TrainingReportDto.Person::sessionsAttended).sum(),
                people.stream().mapToLong(TrainingReportDto.Person::minutesAttended).sum());
        return new TrainingReportDto(summary, people);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** Half-open {@code [fromTs, toTs)}; open at the start for an "all time" window. */
    private static String within(String column, ReportWindow w) {
        return w.from() == null
                ? "(" + column + " < :toTs)"
                : "(" + column + " >= :fromTs AND " + column + " < :toTs)";
    }

    /** Bound as UTC offsets, like the other registers, so the comparison is instant to instant. */
    private static void bindWindow(MapSqlParameterSource params, ReportWindow w) {
        if (w.from() != null) params.addValue("fromTs", utc(w.fromTs()));
        params.addValue("toTs", utc(w.toTs()));
    }

    private static OffsetDateTime utc(Instant at) {
        return OffsetDateTime.ofInstant(at, ZoneOffset.UTC);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toInstant();
    }

    private static String[] names(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).toArray(String[]::new);
    }

    private static String[] append(String[] names, String extra) {
        String[] out = Arrays.copyOf(names, names.length + 1);
        out[names.length] = extra;
        return out;
    }

    private static Map<String, Long> zeros(String[] keys) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (String k : keys) m.put(k, 0L);
        return m;
    }
}
