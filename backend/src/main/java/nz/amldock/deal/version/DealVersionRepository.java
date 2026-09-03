package nz.amldock.deal.version;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DealVersionRepository extends JpaRepository<DealVersion, Long> {

    /** Newest first — the order the Versions menu reads in. Served by idx_deal_version_deal. */
    List<DealVersion> findAllByDealIdOrderByVersionNoDesc(Long dealId);

    Optional<DealVersion> findByDealIdAndVersionNo(Long dealId, Integer versionNo);

    /** The version a reopen stamps, and the one the next verification numbers itself after. */
    Optional<DealVersion> findTopByDealIdOrderByVersionNoDesc(Long dealId);

    long countByDealId(Long dealId);
}
