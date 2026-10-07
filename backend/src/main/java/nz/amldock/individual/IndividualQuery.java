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
     * @param q            contains-match on owner name, deal reference or property address
     * @param verification only owners with this verification outcome, e.g. VERIFIED_WITH_EXCEPTION
     */
    public record Filter(Long firmId, Long branchId, boolean allTypes, String q,
                         Residence residence, String verification) {}

    private static final String NAME_MATCH = " ILIKE :q" + PageRequests.LIKE_ESCAPE;
    private static final String ADDRESS_MATCH = PageRequests.ADDRESS_SEARCH_SQL + NAME_MATCH;
    /** Ownership structures of deals whose reference matches. */
    private static final String STRUCTURES_BY_REFERENCE = "SELECT s2.id FROM ownership_structure s2"
            + " JOIN deal dr ON dr.id = s2.deal_id WHERE dr.reference" + NAME_MATCH;
    /** Ownership structures of deals whose property address matches. */
    private static final String STRUCTURES_BY_ADDRESS = "SELECT s3.id FROM ownership_structure s3"
            + " JOIN deal d3 ON d3.id = s3.deal_id JOIN property p ON p.id = d3.property_id WHERE " + ADDRESS_MATCH;

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
        // agent, a branch) or a search arm has to be tested on the deal row (see below).
        boolean firmOnly = scope.firmId() != null && scope.branchId() == null && scope.creatorId() == null;
        Search search = pattern == null ? null : planSearch(scope, pattern);
        boolean joinDeal = !firmOnly || (search != null && search.needsDeal());
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
        if (search != null) {
            where.append(search.sql());
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
     * Which shape the search takes. Owner search has three arms (owner name, deal reference,
     * property address), and each is cheap one of two ways: a rare term through its trigram index
     * (cost: its matches), a common one tested on the scope's rows (cost: until the page and the
     * count cap fill, which a common term does quickly). Testing the deal arms on the row used to
     * force a join of every owner in the firm to its deal, ~220 of 316 ms at 25k deals per firm
     * (perf/reports/2026-10-06-scale-500k.md, "big firms").
     *
     * <ul>
     *   <li><b>Agent</b>: their deals are few, so every arm is tested on the scoped rows.</li>
     *   <li><b>Platform-wide (ROOT)</b>: one sub-select per arm, so each trigram index finds its
     *       matches. A single OR across the joined tables would force a join of everything.</li>
     *   <li><b>Firm or branch</b>: probe each arm's index ({@link SearchProbe}). All rare: the
     *       union of their matches, intersected with the scope. Otherwise the scope's owners are
     *       walked: the name is tested on the owner row, a rare deal arm becomes a set of
     *       structures to test membership in, and only a common deal arm is tested on the deal
     *       row, which is the one case that joins the deal.</li>
     * </ul>
     */
    private Search planSearch(DealScope scope, String pattern) {
        if (scope.creatorId() != null) {
            return new Search(" AND (n.display_name" + NAME_MATCH + " OR d.reference" + NAME_MATCH
                    + " OR EXISTS (SELECT 1 FROM property p WHERE p.id = d.property_id AND " + ADDRESS_MATCH + "))", true);
        }
        if (!scope.isNarrow()) {
            return new Search(" AND (n.id IN (SELECT nn.id FROM ownership_node nn WHERE nn.display_name" + NAME_MATCH + ")"
                    + " OR d.id IN (SELECT dr.id FROM deal dr WHERE dr.reference" + NAME_MATCH + ")"
                    + " OR d.property_id IN (SELECT p.id FROM property p WHERE " + ADDRESS_MATCH + "))", true);
        }
        boolean fewNames = probe.fewerThan("FROM ownership_node nn WHERE nn.display_name" + NAME_MATCH, pattern, SearchProbe.CAP);
        boolean fewRefs = probe.fewerThan("FROM deal dr WHERE dr.reference" + NAME_MATCH, pattern, SearchProbe.CAP);
        boolean fewAddresses = probe.fewerThan("FROM property p WHERE " + ADDRESS_MATCH, pattern, SearchProbe.CAP);
        if (fewNames && fewRefs && fewAddresses) {
            return new Search(" AND n.id IN (SELECT nn.id FROM ownership_node nn WHERE nn.display_name" + NAME_MATCH
                    + " UNION SELECT n2.id FROM ownership_node n2 WHERE n2.ownership_structure_id IN (" + STRUCTURES_BY_REFERENCE + ")"
                    + " UNION SELECT n3.id FROM ownership_node n3 WHERE n3.ownership_structure_id IN (" + STRUCTURES_BY_ADDRESS + "))", false);
        }
        String byReference = fewRefs
                ? "n.ownership_structure_id IN (" + STRUCTURES_BY_REFERENCE + ")"
                : "d.reference" + NAME_MATCH;
        String byAddress = fewAddresses
                ? "n.ownership_structure_id IN (" + STRUCTURES_BY_ADDRESS + ")"
                : "EXISTS (SELECT 1 FROM property p WHERE p.id = d.property_id AND " + ADDRESS_MATCH + ")";
        return new Search(" AND (n.display_name" + NAME_MATCH + " OR " + byReference + " OR " + byAddress + ")",
                !fewRefs || !fewAddresses);
    }

    /** @param needsDeal the search tests the deal row, so the outer query must join it */
    private record Search(String sql, boolean needsDeal) {}
}
