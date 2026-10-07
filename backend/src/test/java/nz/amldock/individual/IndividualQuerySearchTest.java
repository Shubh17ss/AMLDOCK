package nz.amldock.individual;

import nz.amldock.common.web.SearchProbe;
import nz.amldock.deal.DealScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The owner search picks its shape per request from how common each arm's term is: rare arms
 * through their indexes, common ones tested on the scope's rows, and the deal joined only when a
 * common deal arm needs its row.
 */
class IndividualQuerySearchTest {

    static final DealScope FIRM = new DealScope(null, 1L, null);
    static final DealScope BRANCH = new DealScope(null, 1L, 10L);
    static final DealScope AGENT = new DealScope(7L, null, null);
    static final DealScope PLATFORM = new DealScope(null, null, null);

    NamedParameterJdbcTemplate jdbc;
    SearchProbe probe;
    IndividualQuery query;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        probe = mock(SearchProbe.class);
        when(jdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(0L);
        query = new IndividualQuery(jdbc, probe);
    }

    @Test
    void allRareArmsAreUnionedThroughTheirIndexesWithoutJoiningTheDeal() {
        probes(true, true, true);
        String sql = countSql(FIRM, "217 Queen");
        assertThat(sql).contains("n.id IN (SELECT nn.id FROM ownership_node nn", " UNION ")
                       .doesNotContain("JOIN deal d ON");
    }

    @Test
    void aCommonNameIsTestedOnTheOwnerRowAndRareDealArmsBecomeStructureSets() {
        probes(false, true, true);
        String sql = countSql(FIRM, "Smith");
        assertThat(sql).contains("n.display_name ILIKE", "n.ownership_structure_id IN (SELECT s2.id",
                                 "n.ownership_structure_id IN (SELECT s3.id")
                       .doesNotContain("JOIN deal d ON", " UNION ");
    }

    @Test
    void aCommonReferenceIsTestedOnTheDealRowSoTheDealIsJoined() {
        probes(true, false, true);
        String sql = countSql(FIRM, "DEAL-2026");
        assertThat(sql).contains("JOIN deal d ON", "d.reference ILIKE", "n.ownership_structure_id IN (SELECT s3.id");
    }

    @Test
    void aBranchScopeKeepsTheDealJoinForTheScopeItself() {
        probes(true, true, true);
        String sql = countSql(BRANCH, "217 Queen");
        assertThat(sql).contains("JOIN deal d ON", "d.firm_branch_id = :scopeBranch", " UNION ");
    }

    @Test
    void agentsAreNotProbedTheirFewDealsAreTestedRowByRow() {
        assertThat(countSql(AGENT, "Smith")).contains("JOIN deal d ON", "n.display_name ILIKE", "d.reference ILIKE");
        verify(probe, never()).fewerThan(anyString(), anyString(), anyLong());
    }

    @Test
    void thePlatformIsNotProbedEachArmUsesItsOwnSubSelect() {
        assertThat(countSql(PLATFORM, "Smith")).contains("n.id IN (SELECT nn.id", "d.id IN (SELECT dr.id");
        verify(probe, never()).fewerThan(anyString(), anyString(), anyLong());
    }

    @Test
    void noSearchMeansNoProbeAndNoDealJoinForAFirm() {
        assertThat(countSql(FIRM, "ab")).doesNotContain("ILIKE", "JOIN deal");
        verify(probe, never()).fewerThan(anyString(), anyString(), anyLong());
    }

    private void probes(boolean fewNames, boolean fewRefs, boolean fewAddresses) {
        when(probe.fewerThan(contains("ownership_node nn"), anyString(), anyLong())).thenReturn(fewNames);
        when(probe.fewerThan(contains("FROM deal dr"), anyString(), anyLong())).thenReturn(fewRefs);
        when(probe.fewerThan(contains("FROM property p"), anyString(), anyLong())).thenReturn(fewAddresses);
    }

    private String countSql(DealScope scope, String q) {
        query.page(scope, new IndividualQuery.Filter(null, null, false, q, null, null), 25, 0);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForObject(sql.capture(), any(SqlParameterSource.class), eq(Long.class));
        return sql.getValue();
    }
}
