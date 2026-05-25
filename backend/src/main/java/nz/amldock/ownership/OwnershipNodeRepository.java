package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OwnershipNodeRepository extends JpaRepository<OwnershipNode, Long> {
    List<OwnershipNode> findAllByOwnershipStructureIdOrderByIdAsc(Long structureId);
}
