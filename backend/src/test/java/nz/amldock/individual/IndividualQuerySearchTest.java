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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Owner search matches the owner's name only, in whichever shape is cheap for the term: a rare name
 * through its index, a common one tested on the scope's rows. Neither needs the deal.
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
    void aRareNameIsLookedUpThroughItsIndexWithoutJoiningTheDeal() {
        when(probe.fewerThan(anyString(), anyString(), anyLong())).thenReturn(true);
        assertThat(countSql(FIRM, "Smith Ltd"))
                .contains("n.id IN (SELECT nn.id FROM ownership_node nn WHERE nn.display_name ILIKE")
                .doesNotContain("JOIN deal");
    }

    @Test
    void aCommonNameIsTestedOnTheOwnerRowWithoutJoiningTheDeal() {
        when(probe.fewerThan(anyString(), anyString(), anyLong())).thenReturn(false);
        assertThat(countSql(FIRM, "Smith"))
                .contains("n.display_name ILIKE")
                .doesNotContain("JOIN deal", "n.id IN (SELECT nn.id");
    }

    @Test
    void aBranchScopeJoinsTheDealForTheScopeOnly() {
        when(probe.fewerThan(anyString(), anyString(), anyLong())).thenReturn(false);
        assertThat(countSql(BRANCH, "Smith")).contains("JOIN deal d ON", "d.firm_branch_id = :scopeBranch",
                "n.display_name ILIKE");
    }

    @Test
    void thePlatformIsProbedToo() {
        when(probe.fewerThan(anyString(), anyString(), anyLong())).thenReturn(true);
        assertThat(countSql(PLATFORM, "Smith Ltd")).contains("n.id IN (SELECT nn.id");
    }

    @Test
    void agentsAreNotProbedTheirFewDealsAreTestedRowByRow() {
        assertThat(countSql(AGENT, "Smith")).contains("JOIN deal d ON", "n.display_name ILIKE");
        verify(probe, never()).fewerThan(anyString(), anyString(), anyLong());
    }

    @Test
    void searchNeverReadsTheDealReferenceOrTheAddress() {
        when(probe.fewerThan(anyString(), anyString(), anyLong())).thenReturn(true);
        assertThat(countSql(BRANCH, "217 Queen")).doesNotContain("reference", "property");
    }

    @Test
    void shortTextIsNoSearchSoNoProbe() {
        assertThat(countSql(FIRM, "ab")).doesNotContain("ILIKE", "JOIN deal");
        verify(probe, never()).fewerThan(anyString(), anyString(), anyLong());
    }

    private String countSql(DealScope scope, String q) {
        query.page(scope, new IndividualQuery.Filter(null, null, false, q, null, null), 25, 0);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForObject(sql.capture(), any(SqlParameterSource.class), eq(Long.class));
        return sql.getValue();
    }
}
