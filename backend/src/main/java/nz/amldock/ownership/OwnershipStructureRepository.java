package nz.amldock.ownership;

import nz.amldock.deal.Deal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OwnershipStructureRepository extends JpaRepository<OwnershipStructure, Long> {
    Optional<OwnershipStructure> findByDealIdAndSide(Long dealId, StructureSide side);

    /**
     * The client's structure - the one the deal's risk, readiness and versions are about: the
     * vendor's on a sale, the purchaser's on a purchase. See {@link StructureSide#subjectOf}.
     */
    default Optional<OwnershipStructure> findSubjectOf(Deal deal) {
        return findByDealIdAndSide(deal.getId(), StructureSide.subjectOf(deal.getTransactionType()));
    }

    /** The other party's structure, recorded once the deal has closed as completed. */
    default Optional<OwnershipStructure> findCounterpartyOf(Deal deal) {
        return findByDealIdAndSide(deal.getId(), StructureSide.counterpartyOf(deal.getTransactionType()));
    }

    /** Every structure on one side behind a set of deals, for readers that span more than one. */
    List<OwnershipStructure> findAllByDealIdInAndSide(Collection<Long> dealIds, StructureSide side);
}
