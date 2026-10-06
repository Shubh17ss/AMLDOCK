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
        StringBuilder from = new StringBuilder()
                .append(" FROM ownership_node n")
                .append(" JOIN ownership_structure s ON s.id = n.ownership_structure_id")
                .append(" JOIN deal d ON d.id = s.deal_id");
        if (f.residence() != null) {
            from.append(" LEFT JOIN beneficial_owner bo ON bo.id = n.beneficial_owner_id");
        }
        if (f.residence() == Residence.OVERSEAS) {
            from.append(" JOIN firm_branch rfb ON rfb.id = d.firm_branch_id")
                .append(" JOIN real_estate_firm rf ON rf.id = rfb.real_estate_firm_id");
        }
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        scope.appendWhere(where, params, "d");
        // Redundant with the deal scope, and that is the point: the owner's own firm column (V56,
        // kept by triggers) lets the register page and the name search start from that firm's
        // index entries instead of joining through every structure and deal on the platform.
        if (scope.firmId() != null) {
            where.append(" AND n.real_estate_firm_id = :ownerFirm");
            params.addValue("ownerFirm", scope.firmId());
        }
        if (!f.allTypes()) where.append(" AND n.node_type = 'INDIVIDUAL'");
        if (f.verification() != null) {
            where.append(" AND n.verification_status = :verification");
            params.addValue("verification", f.verification());
        }
        if (f.residence() == Residence.OVERSEAS) {
            where.append(" AND bo.country_of_residence IS NOT NULL AND bo.country_of_residence <> rf.country");
        } else if (f.residence() == Residence.UNANSWERED) {
            where.append(" AND bo.country_of_residence IS NULL");
        }
        String pattern = PageRequests.containsPattern(f.q());
        if (pattern != null) {
            // Same two shapes as DealListQuery.appendSearch. With a narrow scope (an agent, a branch
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
