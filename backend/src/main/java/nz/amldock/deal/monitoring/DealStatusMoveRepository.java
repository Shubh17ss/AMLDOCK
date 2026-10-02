package nz.amldock.deal.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DealStatusMoveRepository extends JpaRepository<DealStatusMove, Long> {

    /** Newest first — the order the Transaction monitoring dialog reads in. */
    List<DealStatusMove> findAllByDealIdOrderByOccurredAtDescIdDesc(Long dealId);

    /** The move before this one, which says when the deal entered the state it is now leaving. */
    Optional<DealStatusMove> findTopByDealIdOrderByOccurredAtDescIdDesc(Long dealId);
}
