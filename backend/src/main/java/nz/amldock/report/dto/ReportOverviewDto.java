package nz.amldock.report.dto;

import java.math.BigDecimal;
import java.util.Map;

/**
 * The top of the management report: the deals created in the window, where they stand, how many
 * reached the market, and what they were worth.
 *
 * <p>{@code open + verified + sold + closedNotSold == created}: every deal is in exactly one.
 *
 * @param created        deals created in the window
 * @param open           of those, NEW, REVIEW or ON_HOLD
 * @param verified       of those, VERIFIED now
 * @param sold           of those, CLOSED with the property sold
 * @param closedNotSold  of those, CLOSED without a sale (including old closes that never said)
 * @param listed         of those, verified at any point, whatever they stand at now: listed on
 *                       the market
 * @param previousListed the same count for the same days a year earlier; null for an "all time"
 *                       window, which has no earlier counterpart
 * @param previousFrom   first day of that earlier window ({@code YYYY-MM-DD}), or null
 * @param previousTo     last day of that earlier window, or null
 * @param appraisedValue sum over the deals of the midpoint of their appraised range
 * @param closingValue   sum of the sale prices of those now CLOSED (a development's is its units')
 * @param byAssurance    ASSURED, ACTION_REQUIRED and AWAITING → count, over signed-off deals only:
 *                       a deal that has not been signed off has nothing to assure
 */
public record ReportOverviewDto(
        long created,
        long open,
        long verified,
        long sold,
        long closedNotSold,
        long listed,
        Long previousListed,
        String previousFrom,
        String previousTo,
        BigDecimal appraisedValue,
        BigDecimal closingValue,
        Map<String, Long> byAssurance) {
}
