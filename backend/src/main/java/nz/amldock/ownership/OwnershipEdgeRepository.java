package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OwnershipEdgeRepository extends JpaRepository<OwnershipEdge, Long> {

    List<OwnershipEdge> findAllByParentNodeIdIn(List<Long> parentNodeIds);
    List<OwnershipEdge> findAllByParentNodeId(Long parentNodeId);
    List<OwnershipEdge> findAllByChildNodeId(Long childNodeId);
    Optional<OwnershipEdge> findByParentNodeIdAndChildNodeId(Long parentNodeId, Long childNodeId);
}
