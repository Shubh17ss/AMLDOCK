package nz.amldock.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface DealNotificationRepository extends JpaRepository<DealNotification, Long> {

    /**
     * Claims the next batch of notifications to send.
     *
     * <p>{@code FOR UPDATE SKIP LOCKED} is Postgres's work-queue primitive: concurrent workers, in
     * this process or another instance, each take a disjoint set instead of colliding on the same
     * rows. That is what removes any need for ShedLock or leader election. Copied wholesale from
     * {@code DocumentRepository.findClaimableOcrIds}, which is the same problem.
     *
     * <p>Two arms. The first is ordinary waiting work. The second reclaims rows a worker claimed
     * and never finished — a process killed mid-send leaves IN_PROGRESS behind, and without this
     * it would sit there forever. Reclaiming is why delivery is at-least-once: a worker that died
     * after SES accepted the message but before the SENT write will send it again.
     *
     * <p>Ordering by id after the due time is load-bearing beyond determinism: rows for one event
     * are inserted together and take adjacent ids, so a claimed batch arrives already grouped for
     * the dispatcher's per-event SES call.
     *
     * <p>Served by {@code idx_deal_notification_claimable}, which is partial, so the cost tracks
     * the backlog rather than the size of the table.
     */
    @Query(value = """
            SELECT id FROM deal_notification
             WHERE (status = 'PENDING'
                    AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
                OR (status = 'IN_PROGRESS' AND claimed_at < :staleBefore)
             ORDER BY next_attempt_at NULLS FIRST, id
             FOR UPDATE SKIP LOCKED
             LIMIT :batchSize
            """, nativeQuery = true)
    List<Long> findClaimableIds(@Param("staleBefore") Instant staleBefore,
                                @Param("batchSize") int batchSize);

    /**
     * Drops delivered rows past the retention window. Their outcome already lives on the audit
     * trail as DEAL_NOTIFICATION_EMAIL_SENT, so the row itself is redundant; without this the
     * table grows without bound.
     *
     * <p>Only SENT. FAILED rows are kept indefinitely — those are the ones somebody needs to see.
     */
    @Modifying
    @Query("DELETE FROM DealNotification n WHERE n.status = nz.amldock.notification.DealNotificationStatus.SENT AND n.sentAt < :before")
    int purgeSentBefore(@Param("before") Instant before);
}
