package nz.amldock.dealnote;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DealNoteRepository extends JpaRepository<DealNote, Long> {
    /** Oldest first — the timeline reads as a conversation, not a feed. */
    List<DealNote> findAllByDealIdOrderByCreatedAtAsc(Long dealId);
}
