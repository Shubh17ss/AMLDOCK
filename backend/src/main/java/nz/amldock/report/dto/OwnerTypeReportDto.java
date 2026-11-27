package nz.amldock.report.dto;

import java.util.List;

/**
 * The owners on the deals created in the window, by owner type: one row per NodeType, in enum
 * order, zeros included, plus the totals.
 *
 * <p>Each owner counts once, however many of those deals it is on. "The same owner" is a shared
 * identity_key, which a copy made with the owner picker inherits from its source; owners typed in
 * separately are not recognised as one. Every kind of owner counts, intermediate companies and
 * trusts included, on both sides of a deal.
 *
 * <p>An owner's type and overseas status are those of its most recent appearance anywhere in the
 * firm: what the owner is now, whatever window is chosen.
 */
public record OwnerTypeReportDto(List<Row> rows, Row total) {

    /**
     * @param ownerType NodeType name, or null on the totals row
     * @param owners    distinct owners of this type
     * @param overseas  of those, overseas residents as at their latest appearance
     */
    public record Row(String ownerType, long owners, long overseas) {
    }
}
