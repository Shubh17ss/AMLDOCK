package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OwnershipNodeRepository extends JpaRepository<OwnershipNode, Long> {
    List<OwnershipNode> findAllByOwnershipStructureIdOrderByIdAsc(Long structureId);

    /** The node standing for a person. One per owner, created with them. */
    Optional<OwnershipNode> findFirstByBeneficialOwnerId(Long beneficialOwnerId);

    /**
     * Nodes of one type across many structures — the individuals register, which walks every deal
     * in a branch. Bulk rather than a call per deal: a branch's register is one page, not N.
     */
    List<OwnershipNode> findAllByOwnershipStructureIdInAndNodeTypeOrderByIdAsc(
            Collection<Long> structureIds, NodeType nodeType);
}
