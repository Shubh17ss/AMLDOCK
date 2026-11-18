package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OwnershipStructureRepository extends JpaRepository<OwnershipStructure, Long> {
    Optional<OwnershipStructure> findByDealIdAndSide(Long dealId, StructureSide side);

    /**
     * The vendor's structure - the one the deal's risk, readiness and versions are about. Named for
     * the side on purpose: a deal now has two, and "the deal's structure" no longer says which.
     */
    default Optional<OwnershipStructure> findVendorByDealId(Long dealId) {
        return findByDealIdAndSide(dealId, StructureSide.VENDOR);
    }

    /** Every structure on one side behind a set of deals, for readers that span more than one. */
    List<OwnershipStructure> findAllByDealIdInAndSide(Collection<Long> dealIds, StructureSide side);
}
