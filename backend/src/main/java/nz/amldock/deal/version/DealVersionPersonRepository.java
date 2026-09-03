package nz.amldock.deal.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DealVersionPersonRepository extends JpaRepository<DealVersionPerson, Long> {

    List<DealVersionPerson> findAllByDealVersionId(Long dealVersionId);
}
