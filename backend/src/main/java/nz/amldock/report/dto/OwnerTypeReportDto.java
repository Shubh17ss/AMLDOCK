package nz.amldock.report.dto;

import java.util.List;

/**
 * Owners on the deals created in the window, by owner type: one row per NodeType, in enum order,
 * zeros included, plus the totals.
 *
 * <p>Every node in a structure counts, intermediate companies and trusts included, on both sides
 * of a deal. That is how the CDD registers count, so the figures here reconcile with them.
 */
public record OwnerTypeReportDto(List<Row> rows, Row total) {

    /**
     * @param ownerType  NodeType name, or null on the totals row
     * @param owners     owner records of this type
     * @param overseas   of those, overseas residents: the Overseas Residents Register's own test
     * @param reused     distinct owners among them that appear on two or more deals in the firm.
     *                   A lower bound: only owners copied with the owner picker are linked
     * @param exceptions of those, cleared as verified with an exception: the CDD Exceptions
     *                   register's own test
     */
    public record Row(String ownerType, long owners, long overseas, long reused, long exceptions) {
    }
}
