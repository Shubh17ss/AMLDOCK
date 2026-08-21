package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OwnershipNodeRepository extends JpaRepository<OwnershipNode, Long> {
    List<OwnershipNode> findAllByOwnershipStructureIdOrderByIdAsc(Long structureId);

    /** The node standing for a person. One per owner, created with them. */
    Optional<OwnershipNode> findFirstByBeneficialOwnerId(Long beneficialOwnerId);
}
