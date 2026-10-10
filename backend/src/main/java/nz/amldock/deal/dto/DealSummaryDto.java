package nz.amldock.deal.dto;

import nz.amldock.deal.DealStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * What the role dashboards show, computed in SQL over every deal in the caller's scope. Replaces
 * the dashboards downloading the whole deals list to count it in the browser.
 *
 * @param byStatus            only statuses with at least one deal are present
 * @param firmsAwaitingReview distinct reporting entities with a deal in REVIEW
 */
public record DealSummaryDto(
        long total,
        Map<DealStatus, StatusSummary> byStatus,
        long firmsAwaitingReview
) {
    /**
     * @param valueSum          sum of the deal value, valuation max falling back to transaction value
     * @param oldestCreatedAt   the longest-waiting deal in this status
     * @param updatedLast30Days deals in this status changed within the last 30 days
     */
    public record StatusSummary(long count, BigDecimal valueSum, Instant oldestCreatedAt, long updatedLast30Days) {}
}
