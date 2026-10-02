package nz.amldock.deal.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * What the deal finished as, answered while closing it.
 *
 * <p>The only status route that carries something other than a note. Closing used to take no body
 * at all, which recorded that a file ended without recording what it ended as.
 *
 * <p>Which of the two value shapes applies is decided by the deal's own property type on the
 * server, never by anything in here — see {@code DealSaleService.close}. A client that could pick
 * its own rules could send a single figure for a development and skip the unit breakdown
 * entirely.
 *
 * @param propertySold required. Null is not "no": a deal still running has not been asked, and
 *                     defaulting the answer would record an outcome nobody stated.
 * @param salePrice    what it sold for, for every property type except a development. Must be
 *                     absent when the property did not sell, and when units carry the figures.
 * @param units        the units of a development and their prices. Must be empty for every other
 *                     property type, and for a property that did not sell.
 * @param note         optional; kept with this close on the Transaction monitoring history.
 */
public record CloseDealRequest(
        @NotNull Boolean propertySold,
        @PositiveOrZero BigDecimal salePrice,
        @Valid List<SaleUnitInput> units,
        @Size(max = 4000) String note
) {
    /**
     * One unit of a development.
     *
     * @param unitName  what the reviewer calls it — "Unit 4B", "Lot 12". Free text, because the
     *                  naming is the development's own and no scheme we imposed would survive
     *                  contact with the next one.
     * @param salePrice what that unit sold for.
     */
    public record SaleUnitInput(
            @Size(max = 160) String unitName,
            @PositiveOrZero BigDecimal salePrice
    ) {}
}
