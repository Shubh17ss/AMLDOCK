package nz.amldock.deal.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DealVersionNodeRepository extends JpaRepository<DealVersionNode, Long> {

    List<DealVersionNode> findAllByDealVersionId(Long dealVersionId);
}
