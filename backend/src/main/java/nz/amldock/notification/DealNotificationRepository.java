package nz.amldock.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface DealNotificationRepository extends JpaRepository<DealNotification, Long> {

    /*
     * Claiming is two queries, not one. {@code FOR UPDATE SKIP LOCKED} is Postgres's work-queue
     * primitive: concurrent workers, in this process or another instance, each take a disjoint set
     * instead of colliding on the same rows. That is what removes any need for ShedLock or leader
     * election.
     *
     * It used to be a single query: "(due PENDING) OR (stale IN_PROGRESS) ORDER BY next_attempt_at
     * NULLS FIRST, id". Every fresh row had a NULL due time, and a B-tree keeps NULLs last, so the
     * index could not supply that order. Postgres sorted the entire backlog, on disk, for every
     * poll: 299 ms for 50 rows at a 362k backlog (perf/reports/2026-10-06-outbox-claim.md). Each
     * query below now matches its own partial index exactly (V55), so it reads about as many index
     * entries as it returns, whatever the size of the backlog. FOR UPDATE does not allow a UNION,
     * hence two calls.
     */

    /**
     * Rows a worker claimed and never finished. A process killed mid-send leaves IN_PROGRESS
     * behind, and without this it would sit there forever. Reclaiming is why delivery is
     * at-least-once: a worker that died after SES accepted the message but before the SENT write
     * will send it again. Served by {@code idx_deal_notification_stale}, which holds only in-flight
     * rows.
     */
    @Query(value = """
            SELECT id FROM deal_notification
             WHERE status = 'IN_PROGRESS' AND claimed_at < :staleBefore
             ORDER BY claimed_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findStaleClaimIds(@Param("staleBefore") Instant staleBefore, @Param("limit") int limit);

    /**
     * Ordinary waiting work: PENDING rows whose due time has come, oldest first. Fresh rows are
     * due when enqueued; retries are due after their backoff.
     *
     * <p>Ordering by id after the due time is load-bearing beyond determinism: rows for one event
     * are inserted together and take adjacent ids, so a claimed batch arrives already grouped for
     * the dispatcher's per-event SES call. Served by {@code idx_deal_notification_due}
     * {@code (next_attempt_at, id) WHERE status = 'PENDING'}.
     */
    @Query(value = """
            SELECT id FROM deal_notification
             WHERE status = 'PENDING' AND next_attempt_at <= now()
             ORDER BY next_attempt_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findDueIds(@Param("limit") int limit);

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
