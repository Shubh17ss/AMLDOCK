package nz.amldock.deal.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DealVersionPropertyRepository extends JpaRepository<DealVersionProperty, Long> {

    Optional<DealVersionProperty> findByDealVersionId(Long dealVersionId);
}
