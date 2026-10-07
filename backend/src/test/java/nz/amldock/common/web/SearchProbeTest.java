package nz.amldock.common.web;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.LongSupplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The probe trusts the planner's estimate when it is clearly under or over the cap, and counts only
 * in the band between, where a term has few enough candidates for the count to be cheap.
 */
class SearchProbeTest {

    static final long CAP = 1000;

    @Test
    void aClearlyRareEstimateIsFewWithoutCounting() {
        AtomicInteger counted = new AtomicInteger();
        assertThat(SearchProbe.decide(85, CAP, counting(counted, 0))).isTrue();
        assertThat(counted).hasValue(0);
    }

    @Test
    void aClearlyCommonEstimateIsManyWithoutCounting() {
        AtomicInteger counted = new AtomicInteger();
        assertThat(SearchProbe.decide(44_000, CAP, counting(counted, 0))).isFalse();
        assertThat(counted).hasValue(0);
    }

    @Test
    void theBandBetweenIsCounted() {
        AtomicInteger counted = new AtomicInteger();
        assertThat(SearchProbe.decide(1_500, CAP, counting(counted, 400))).isTrue();
        assertThat(SearchProbe.decide(300, CAP, counting(counted, 1000))).isFalse();
        assertThat(counted).hasValue(2);
    }

    @Test
    void theBandScalesWithASmallerCap() {
        // DealListQuery caps at the scope's size: a 40-deal branch with an estimate of 200 matches
        // is clearly common for that branch.
        AtomicInteger counted = new AtomicInteger();
        assertThat(SearchProbe.decide(200, 40, counting(counted, 0))).isFalse();
        assertThat(counted).hasValue(0);
    }

    private static LongSupplier counting(AtomicInteger counted, long result) {
        return () -> { counted.incrementAndGet(); return result; };
    }
}
