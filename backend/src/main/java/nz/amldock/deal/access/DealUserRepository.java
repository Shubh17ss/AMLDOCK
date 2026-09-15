package nz.amldock.deal.access;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DealUserRepository extends JpaRepository<DealUser, Long> {

    List<DealUser> findAllByDealIdOrderByIdAsc(Long dealId);

    Optional<DealUser> findByDealIdAndUserId(Long dealId, Long userId);

    /**
     * The read gate, asked once per deal opened. Indexed on (deal_id, user_id) by the unique
     * constraint, so this is a lookup rather than a scan.
     */
    boolean existsByDealIdAndUserId(Long dealId, Long userId);
}
