package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OwnershipStructureRepository extends JpaRepository<OwnershipStructure, Long> {
    Optional<OwnershipStructure> findByDealId(Long dealId);

    /** Every structure behind a set of deals, for readers that span more than one. */
    List<OwnershipStructure> findAllByDealIdIn(Collection<Long> dealIds);
}
