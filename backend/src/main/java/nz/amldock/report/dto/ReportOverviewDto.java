package nz.amldock.report.dto;

import java.util.Map;

/**
 * The top of the management report: deals created in the window, cut three ways.
 *
 * <p>Every map lists each key in a fixed order, zeros included, so a chart's bars and slices
 * never shift about as the window changes.
 *
 * @param created        deals created in the window
 * @param open           of those, still NEW, REVIEW or ON_HOLD
 * @param signedOff      of those, VERIFIED or CLOSED
 * @param highRisk       of those, rated HIGH
 * @param actionRequired of those, signed off with assurance ACTION_REQUIRED
 * @param byStatus       DealStatus name → count
 * @param byRisk         LOW, MEDIUM, HIGH and NOT_ASSESSED (no rating yet) → count
 * @param byAssurance    ASSURED, ACTION_REQUIRED and AWAITING → count, over signed-off deals only:
 *                       a deal that has not been signed off has nothing to assure
 */
public record ReportOverviewDto(
        long created,
        long open,
        long signedOff,
        long highRisk,
        long actionRequired,
        Map<String, Long> byStatus,
        Map<String, Long> byRisk,
        Map<String, Long> byAssurance) {
}
