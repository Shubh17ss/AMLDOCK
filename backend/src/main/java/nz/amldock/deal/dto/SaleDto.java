package nz.amldock.deal.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * What a deal finished as, as the Transaction Monitoring tab reads it.
 *
 * <p>Its own payload behind its own endpoint, the way the Risk tab is fed by {@code /risk},
 * rather than fields on {@code DealDto}: the unit list is a per-deal query, and hanging it off
 * every deal fetch would make the dashboards pay for a tab almost nobody has open.
 *
 * @param propertySold null while the deal has never been closed — "not asked yet", which reads
 *                     differently from a recorded No and has to stay distinguishable.
 * @param salePrice    the single figure, for every property type but a development. Null
 *                     otherwise.
 * @param total        what the whole thing sold for: the single figure, or the sum of the units.
 *                     Computed on read rather than stored, so it cannot drift from the rows
 *                     underneath it.
 * @param units        empty unless the property is a development that sold.
 */
public record SaleDto(
        Boolean propertySold,
        BigDecimal salePrice,
        BigDecimal total,
        List<SaleUnitDto> units
) {
    public record SaleUnitDto(Long id, String unitName, BigDecimal salePrice) {}
}
