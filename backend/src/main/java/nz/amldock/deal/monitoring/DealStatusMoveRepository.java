package nz.amldock.deal.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DealStatusMoveRepository extends JpaRepository<DealStatusMove, Long> {

    /** Newest first — the order the Transaction monitoring dialog reads in. */
    List<DealStatusMove> findAllByDealIdOrderByOccurredAtDescIdDesc(Long dealId);

    /** The move before this one, which says when the deal entered the state it is now leaving. */
    Optional<DealStatusMove> findTopByDealIdOrderByOccurredAtDescIdDesc(Long dealId);

    /** When each deal last made a move of this kind, one row per deal as {@code [dealId, Instant]}. */
    @Query("select m.dealId, max(m.occurredAt) from DealStatusMove m "
            + "where m.dealId in :dealIds and m.kind = :kind group by m.dealId")
    List<Object[]> latestAt(@Param("dealIds") Collection<Long> dealIds,
                            @Param("kind") DealStatusMove.Kind kind);
}
