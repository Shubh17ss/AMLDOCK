package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnershipNodeRepository extends JpaRepository<OwnershipNode, Long> {
    List<OwnershipNode> findAllByOwnershipStructureIdOrderByIdAsc(Long structureId);

    /** Every node standing for one person record — an ID scan's owner, for the verification reset. */
    List<OwnershipNode> findAllByBeneficialOwnerId(Long beneficialOwnerId);

    /** The node standing for a person. One per owner, created with them. */
    Optional<OwnershipNode> findFirstByBeneficialOwnerId(Long beneficialOwnerId);

    /**
     * Nodes of one type across many structures — the individuals register, which walks every deal
     * in a branch. Bulk rather than a call per deal: a branch's register is one page, not N.
     */
    List<OwnershipNode> findAllByOwnershipStructureIdInAndNodeTypeOrderByIdAsc(
            Collection<Long> structureIds, NodeType nodeType);

    /**
     * The same walk, every type. The CDD registers list whoever stands behind a branch's deals,
     * and a trust holding the property is as much an owner on the register as the person behind it.
     */
    List<OwnershipNode> findAllByOwnershipStructureIdInOrderByIdAsc(Collection<Long> structureIds);

    /** Every node standing for the same person or entity, across deals — the verification trail. */
    List<OwnershipNode> findAllByIdentityKeyAndVerificationStatusIn(
            UUID identityKey, Collection<NodeVerificationStatus> statuses);
}
