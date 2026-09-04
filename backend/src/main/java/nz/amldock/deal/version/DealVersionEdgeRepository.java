package nz.amldock.deal.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DealVersionEdgeRepository extends JpaRepository<DealVersionEdge, Long> {

    List<DealVersionEdge> findAllByDealVersionId(Long dealVersionId);
}
