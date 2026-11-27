package nz.amldock.report.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Deals by property type: one row per type, in PropertyType order, zeros included, plus a "Not
 * set" row when any deal has no type, and the totals.
 */
public record PropertyTypeReportDto(List<Row> rows, Row total) {

    /**
     * @param propertyType      PropertyType name, {@code NOT_SET}, or null on the totals row
     * @param created           created in the window
     * @param createdPercent    share of all deals created in the window, 0-100
     * @param verified          signed off in the window and still VERIFIED or CLOSED
     * @param closed            closed in the window and still CLOSED
     * @param verifiedAllTime   VERIFIED or CLOSED now, whenever created
     * @param unverifiedAllTime NEW, REVIEW or ON_HOLD now, whenever created
     * @param sold              closed in the window with the property sold, i.e. with a sale price
     * @param averageSalePrice  over {@code sold}; null when there are none
     * @param maxSalePrice      over {@code sold}; null when there are none
     */
    public record Row(
            String propertyType,
            long created,
            double createdPercent,
            long verified,
            long closed,
            long verifiedAllTime,
            long unverifiedAllTime,
            long sold,
            BigDecimal averageSalePrice,
            BigDecimal maxSalePrice) {
    }
}
