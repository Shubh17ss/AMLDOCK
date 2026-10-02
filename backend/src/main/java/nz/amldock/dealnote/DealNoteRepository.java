package nz.amldock.dealnote;

import nz.amldock.deal.DealStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface DealNoteRepository extends JpaRepository<DealNote, Long> {
    /** Oldest first — the timeline reads as a conversation, not a feed. */
    List<DealNote> findAllByDealIdOrderByCreatedAtAsc(Long dealId);

    /**
     * When each deal last moved into a status, one row per deal as {@code [dealId, Instant]}.
     * The deal row does not keep a closed date of its own; the timeline's transition entry is
     * where that moment is recorded.
     */
    @Query("select n.dealId, max(n.createdAt) from DealNote n "
            + "where n.dealId in :dealIds and n.statusTo = :status group by n.dealId")
    List<Object[]> latestTransitionAt(@Param("dealIds") Collection<Long> dealIds,
                                      @Param("status") DealStatus status);
}
