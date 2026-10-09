package nz.amldock.individual;

import nz.amldock.common.web.IdPage;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.SearchProbe;
import nz.amldock.deal.DealScope;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * The owners register, paged in SQL. Applies the deal scope through the owner's own firm column
 * where it can, and through owner node → structure → deal otherwise, so the caller's whole book
 * of deals is never loaded to answer for one page. Returns node ids, newest first.
 */
@Repository
public class IndividualQuery {

    /** Server-side forms of the filters the registers used to apply in the browser. */
    public enum Residence {
        /** Country of residence recorded and different from the deal's reporting-entity country. */
        OVERSEAS,
        /** Nobody has recorded a country of residence (or the person record is gone). */
        UNANSWERED
    }

    /**
     * @param allTypes     every kind of owner, not only natural persons
     * @param q            contains-match on the owner's name (3+ characters)
     * @param verification only owners with this verification outcome, e.g. VERIFIED_WITH_EXCEPTION
     */
    public record Filter(Long firmId, Long branchId, boolean allTypes, String q,
                         Residence residence, String verification) {}

    private static final String NAME_MATCH = " ILIKE :q" + PageRequests.LIKE_ESCAPE;

    private final NamedParameterJdbcTemplate jdbc;
    private final SearchProbe probe;

    public IndividualQuery(NamedParameterJdbcTemplate jdbc, SearchProbe probe) {
        this.jdbc = jdbc;
        this.probe = probe;
    }

    public IdPage page(DealScope scope, Filter f, int limit, long offset) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String pattern = PageRequests.containsPattern(f.q());
        // A firm-only scope (compliance staff, or ROOT filtering by firm) is answered from the
        // owner's own firm column (V56, kept exact by triggers), so the owner table alone is
        // enough: no join through structure and deal, and the register walks the (firm, id DESC)
        // indexes and stops after the page. The deal is joined only when it narrows further (an
        // agent, a branch); search reads the owner's own name, so it never needs the deal.
        boolean firmOnly = scope.firmId() != null && scope.branchId() == null && scope.creatorId() == null;
        boolean joinDeal = !firmOnly;
        StringBuilder from = new StringBuilder(" FROM ownership_node n");
        if (joinDeal) {
            from.append(" JOIN ownership_structure s ON s.id = n.ownership_structure_id")
                .append(" JOIN deal d ON d.id = s.deal_id");
        }
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (joinDeal) scope.appendWhere(where, params, "d");
        // With a firm in scope the owner's firm column is the index-friendly form of it.
        if (scope.firmId() != null) {
            where.append(" AND n.real_estate_firm_id = :ownerFirm");
            params.addValue("ownerFirm", scope.firmId());
        }
        if (!f.allTypes()) where.append(" AND n.node_type = 'INDIVIDUAL'");
        // Sparse states are read off the owner row (V57: residence_country / is_overseas kept by
        // triggers) and each has a partial index, so a filter that matches few owners costs those
        // few, not every owner in the firm (1.1-1.4 s at 25k deals per firm before).
        if (f.verification() != null) {
            // Inlined, not bound: a partial index (idx_ownership_node_exception) only matches a
            // literal predicate, and the driver's generic prepared plans would not use it. Safe:
            // the value is a NodeVerificationStatus name, validated by the controller.
            String status = nz.amldock.ownership.NodeVerificationStatus.valueOf(f.verification()).name();
            where.append(" AND n.verification_status = '").append(status).append("'");
        }
        if (f.residence() == Residence.OVERSEAS) {
            where.append(" AND n.is_overseas");
        } else if (f.residence() == Residence.UNANSWERED) {
            where.append(" AND n.residence_country IS NULL");
        }
        if (pattern != null) {
            where.append(searchSql(scope, pattern));
            params.addValue("q", pattern);
        }

        long total = jdbc.queryForObject(PageRequests.cappedCountSql(from.toString() + where), params, Long.class);
        boolean exact = total <= PageRequests.COUNT_CAP;
        if (total == 0 || (exact && offset >= total)) return new IdPage(List.of(), total, exact);
        params.addValue("limit", limit).addValue("offset", offset);
        List<Long> ids = jdbc.queryForList("SELECT n.id" + from + where
                + " ORDER BY n.id DESC LIMIT :limit OFFSET :offset", params, Long.class);
        return new IdPage(ids, total, exact);
    }

    /**
     * The name search, in whichever shape is cheap for this term. Owner name only: the picker and
     * the registers search for a person, and the deal reference and address arms used to force a
     * join of every owner in the firm to its deal (~220 of 316 ms at 25k deals per firm,
     * perf/reports/2026-10-06-scale-500k.md, "big firms").
     *
     * <ul>
     *   <li><b>Agent</b>: their deals are few, so the name is tested on the scoped rows.</li>
     *   <li><b>Everyone else</b>: ask the name's trigram index how common the term is
     *       ({@link SearchProbe}). Rare: the matches through the index, intersected with the
     *       scope, costing the matches. Common: tested on the scope's owners newest first, which
     *       fills the page and the count cap within a few rows.</li>
     * </ul>
     */
    private String searchSql(DealScope scope, String pattern) {
        String onRow = " AND n.display_name" + NAME_MATCH;
        if (scope.creatorId() != null) return onRow;
        String matches = "FROM ownership_node nn WHERE nn.display_name" + NAME_MATCH;
        return probe.fewerThan(matches, pattern, SearchProbe.CAP)
                ? " AND n.id IN (SELECT nn.id " + matches + ")"
                : onRow;
    }
}
