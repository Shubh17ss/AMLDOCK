package nz.amldock.deal.sale;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DealSaleUnitRepository extends JpaRepository<DealSaleUnit, Long> {

    /** One deal's units, in the order they were entered. */
    List<DealSaleUnit> findAllByDealIdOrderBySortOrderAsc(Long dealId);

    /** Clears the set before a re-close writes the replacement. */
    void deleteAllByDealId(Long dealId);
}
