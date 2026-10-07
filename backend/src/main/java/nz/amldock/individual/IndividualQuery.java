package nz.amldock.individual;

import nz.amldock.common.web.IdPage;
import nz.amldock.common.web.PageRequests;
import nz.amldock.deal.DealScope;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * The owners register, paged in SQL. Walks owner node → structure → deal and applies the deal
 * scope on the way, so the caller's whole book of deals is never loaded to answer for one page.
 * Returns node ids, newest first.
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
     * @param q            contains-match on owner name, deal reference or property address
     * @param verification only owners with this verification outcome, e.g. VERIFIED_WITH_EXCEPTION
     */
    public record Filter(Long firmId, Long branchId, boolean allTypes, String q,
                         Residence residence, String verification) {}

    private final NamedParameterJdbcTemplate jdbc;

    public IndividualQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public IdPage page(DealScope scope, Filter f, int limit, long offset) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String pattern = PageRequests.containsPattern(f.q());
        // A firm-only scope (compliance staff, or ROOT filtering by firm) is answered from the
        // owner's own firm column (V56, kept exact by triggers), so the owner table alone is
        // enough: no join through structure and deal, and the register walks the (firm, id DESC)
        // indexes and stops after the page. The deal is joined only when it narrows further (an
        // agent, a branch) or a search reads its reference and address.
        boolean firmOnly = scope.firmId() != null && scope.branchId() == null && scope.creatorId() == null;
        boolean joinDeal = !firmOnly || pattern != null;
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
        // (pattern computed above: it also decides whether the deal is joined)
        if (pattern != null) {
            // Two shapes (DealListQuery.appendSearch now picks per request; this one still goes by
            // scope alone). With a narrow scope (an agent, a branch
            // or a firm; the firm also via idx_ownership_node_firm_id), the fields are tested on the
            // scoped rows directly, so cost tracks the scope rather than the platform's matches.
            // Platform-wide (ROOT), one sub-select per field lets each trigram index find matches;
            // a single OR across the joined tables would force a join of everything first.
            if (scope.isNarrow()) {
                where.append(" AND (n.display_name ILIKE :q").append(PageRequests.LIKE_ESCAPE)
                     .append(" OR d.reference ILIKE :q").append(PageRequests.LIKE_ESCAPE)
                     .append(" OR EXISTS (SELECT 1 FROM property p WHERE p.id = d.property_id AND ")
                     .append(PageRequests.ADDRESS_SEARCH_SQL).append(" ILIKE :q")
                     .append(PageRequests.LIKE_ESCAPE).append("))");
            } else {
                where.append(" AND (n.id IN (SELECT nn.id FROM ownership_node nn WHERE nn.display_name ILIKE :q")
                     .append(PageRequests.LIKE_ESCAPE).append(")")
                     .append(" OR d.id IN (SELECT dr.id FROM deal dr WHERE dr.reference ILIKE :q")
                     .append(PageRequests.LIKE_ESCAPE).append(")")
                     .append(" OR d.property_id IN (SELECT p.id FROM property p WHERE ")
                     .append(PageRequests.ADDRESS_SEARCH_SQL).append(" ILIKE :q")
                     .append(PageRequests.LIKE_ESCAPE).append("))");
            }
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
}
