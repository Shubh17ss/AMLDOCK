package nz.amldock.deal.monitoring;

import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.monitoring.DealStatusMove.Kind;
import nz.amldock.deal.monitoring.dto.StatusMoveDto;
import nz.amldock.deal.monitoring.dto.StatusMoveDto.Variance;
import nz.amldock.deal.version.DealVersion;
import nz.amldock.deal.version.DealVersionRepository;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Recording each move between Verified and Closed, and the variance rule that judges a close.
 */
@ExtendWith(MockitoExtension.class)
class TransactionMonitoringServiceTest {

    static final Long DEAL_ID = 1L;
    static final Instant VERIFIED_AT = Instant.parse("2026-09-10T02:00:00Z");

    @Mock DealStatusMoveRepository moves;
    @Mock DealVersionRepository versions;
    @Mock UserRepository users;

    TransactionMonitoringService service;
    Deal deal;

    @BeforeEach
    void setUp() {
        service = new TransactionMonitoringService(moves, versions, users);

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setValuationMin(new BigDecimal("900000"));
        deal.setValuationMax(new BigDecimal("1000000"));

        DealVersion v2 = DealVersion.copyOf(deal, 2, 5L, "Checked");
        ReflectionTestUtils.setField(v2, "verifiedAt", VERIFIED_AT);
        lenient().when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.of(v2));
        lenient().when(moves.findTopByDealIdOrderByOccurredAtDescIdDesc(DEAL_ID)).thenReturn(Optional.empty());
        lenient().when(users.findAllById(any())).thenReturn(List.of());
    }

    /* ---------- recording ---------- */

    @Test
    void aFirstCloseRunsFromTheVerificationAndCopiesTheFigures() {
        service.recordClose(deal, 5L, "  Settled  ", true, new BigDecimal("950000"));

        DealStatusMove m = saved();
        assertThat(m.getKind()).isEqualTo(Kind.CLOSE);
        assertThat(m.getFromAt()).isEqualTo(VERIFIED_AT);
        assertThat(m.getOccurredAt()).isNotNull();
        assertThat(m.getVersionNo()).isEqualTo(2);
        assertThat(m.getValuationMin()).isEqualByComparingTo("900000");
        assertThat(m.getValuationMax()).isEqualByComparingTo("1000000");
        assertThat(m.getSaleTotal()).isEqualByComparingTo("950000");
        assertThat(m.getNote()).isEqualTo("Settled");
    }

    @Test
    void aCloseAfterAnUncloseRunsFromTheUnclose() {
        Instant uncloseAt = Instant.parse("2026-09-20T03:00:00Z");
        DealStatusMove unclose = new DealStatusMove(DEAL_ID, Kind.UNCLOSE, null, uncloseAt, 5L, 2,
                null, null, null, null, "Wrong price");
        when(moves.findTopByDealIdOrderByOccurredAtDescIdDesc(DEAL_ID)).thenReturn(Optional.of(unclose));

        service.recordClose(deal, 5L, null, true, new BigDecimal("990000"));

        assertThat(saved().getFromAt()).isEqualTo(uncloseAt);
    }

    @Test
    void anUnsoldCloseKeepsNoTotal() {
        service.recordClose(deal, 5L, null, false, new BigDecimal("950000"));

        assertThat(saved().getSaleTotal()).isNull();
    }

    @Test
    void anUncloseRunsFromTheCloseItUndoes() {
        Instant closedAt = Instant.parse("2026-09-15T01:00:00Z");
        DealStatusMove close = new DealStatusMove(DEAL_ID, Kind.CLOSE, VERIFIED_AT, closedAt, 5L, 2,
                null, null, true, new BigDecimal("950000"), null);
        when(moves.findTopByDealIdOrderByOccurredAtDescIdDesc(DEAL_ID)).thenReturn(Optional.of(close));

        service.recordUnclose(deal, 5L, "Wrong price");

        DealStatusMove m = saved();
        assertThat(m.getKind()).isEqualTo(Kind.UNCLOSE);
        assertThat(m.getFromAt()).isEqualTo(closedAt);
        assertThat(m.getVersionNo()).isEqualTo(2);
        assertThat(m.getSaleTotal()).isNull();
        assertThat(m.getNote()).isEqualTo("Wrong price");
    }

    /* ---------- reading ---------- */

    @Test
    void theHistoryNamesBothEndsAndJudgesEachClose() {
        DealStatusMove close = new DealStatusMove(DEAL_ID, Kind.CLOSE, VERIFIED_AT,
                Instant.parse("2026-09-15T01:00:00Z"), 5L, 2,
                new BigDecimal("900000"), new BigDecimal("1000000"), true, new BigDecimal("1300000"), null);
        DealStatusMove unclose = new DealStatusMove(DEAL_ID, Kind.UNCLOSE,
                Instant.parse("2026-09-15T01:00:00Z"), Instant.parse("2026-09-16T01:00:00Z"), 5L, 2,
                new BigDecimal("900000"), new BigDecimal("1000000"), null, null, "Wrong price");
        when(moves.findAllByDealIdOrderByOccurredAtDescIdDesc(DEAL_ID)).thenReturn(List.of(unclose, close));

        List<StatusMoveDto> out = service.history(DEAL_ID);

        assertThat(out.get(0).fromStatus()).isEqualTo(DealStatus.CLOSED);
        assertThat(out.get(0).toStatus()).isEqualTo(DealStatus.VERIFIED);
        assertThat(out.get(0).variance()).isNull();
        assertThat(out.get(1).fromStatus()).isEqualTo(DealStatus.VERIFIED);
        assertThat(out.get(1).toStatus()).isEqualTo(DealStatus.CLOSED);
        assertThat(out.get(1).variance()).isEqualTo(Variance.BEYOND);
    }

    /* ---------- the variance rule ---------- */

    @Test
    void varianceEdges() {
        BigDecimal min = new BigDecimal("900000");
        BigDecimal max = new BigDecimal("1000000");
        // min × 0.8 = 720,000; max × 1.2 = 1,200,000 — both inclusive.
        assertThat(TransactionMonitoringService.variance(min, max, new BigDecimal("720000"))).isEqualTo(Variance.WITHIN);
        assertThat(TransactionMonitoringService.variance(min, max, new BigDecimal("719999.99"))).isEqualTo(Variance.BEYOND);
        assertThat(TransactionMonitoringService.variance(min, max, new BigDecimal("1200000"))).isEqualTo(Variance.WITHIN);
        assertThat(TransactionMonitoringService.variance(min, max, new BigDecimal("1200000.01"))).isEqualTo(Variance.BEYOND);
        assertThat(TransactionMonitoringService.variance(min, max, new BigDecimal("950000"))).isEqualTo(Variance.WITHIN);
    }

    @Test
    void nothingToCompareIsNoVariance() {
        assertThat(TransactionMonitoringService.variance(null, new BigDecimal("1"), new BigDecimal("1"))).isNull();
        assertThat(TransactionMonitoringService.variance(new BigDecimal("1"), new BigDecimal("1"), null)).isNull();
    }

    private DealStatusMove saved() {
        ArgumentCaptor<DealStatusMove> c = ArgumentCaptor.forClass(DealStatusMove.class);
        verify(moves).save(c.capture());
        return c.getValue();
    }
}
