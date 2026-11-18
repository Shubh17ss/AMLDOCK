package nz.amldock.deal.monitoring.dto;

import nz.amldock.deal.DealStatus;
import nz.amldock.deal.monitoring.DealStatusMove;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One row of the Transaction monitoring dialog: a move, both ends of it, and what it was worth.
 *
 * @param id        the move, which is what a note edit addresses
 * @param fromAt    when the deal entered {@code fromStatus}
 * @param occurredAt when it moved to {@code toStatus}
 * @param versionNo the version the deal stood on — what clicking either label opens
 * @param saleTotal the sale price, or a development's unit total; null when not sold or an unclose
 * @param variance  the sale against the valuation, or null where there is nothing to compare
 * @param noteEditedAt when the note was last changed after the move; null if it never was
 */
public record StatusMoveDto(
        Long id,
        DealStatusMove.Kind kind,
        DealStatus fromStatus,
        DealStatus toStatus,
        Instant fromAt,
        Instant occurredAt,
        Integer versionNo,
        BigDecimal valuationMin,
        BigDecimal valuationMax,
        Boolean propertySold,
        BigDecimal saleTotal,
        Variance variance,
        String note,
        String actorName,
        Instant noteEditedAt,
        String noteEditorName
) {
    public enum Variance { WITHIN, BEYOND }
}
