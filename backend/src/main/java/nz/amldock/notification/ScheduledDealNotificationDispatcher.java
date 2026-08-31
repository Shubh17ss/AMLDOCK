package nz.amldock.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Polls the notification outbox and sends what it finds.
 *
 * <p>Nothing here touches a Tomcat request thread: {@code @Scheduled} supplies its own scheduler
 * thread, and the send happens on it. Deal saves stay exactly as fast as they were.
 *
 * <p>Orchestration lives here rather than in {@link DealNotificationDispatchService} because the
 * three phases are separate transactions, and calling one {@code @Transactional} method from
 * another on the same bean would bypass Spring's proxy and quietly run the whole thing outside a
 * transaction.
 *
 * <p>No executor of its own, unlike the OCR poller. That one needs a pool because each Textract
 * call blocks for seconds and the work is per-document; here a whole event's recipients go out in
 * one API call, so a batch is a handful of calls and concurrency would buy nothing but a pool to
 * tune.
 */
@Component
@ConditionalOnProperty(name = "amldock.notifications.enabled",
                       havingValue = "true", matchIfMissing = true)
public class ScheduledDealNotificationDispatcher {

    private static final Logger log =
            LoggerFactory.getLogger(ScheduledDealNotificationDispatcher.class);

    private final DealNotificationDispatchService dispatch;
    private final int batchSize;

    public ScheduledDealNotificationDispatcher(
            DealNotificationDispatchService dispatch,
            @Value("${amldock.notifications.batch-size:50}") int batchSize) {
        this.dispatch = dispatch;
        this.batchSize = batchSize;
    }

    /**
     * {@code fixedDelay}, not {@code fixedRate}: the next poll is measured from the end of the
     * last, so a slow batch can never stack ticks on top of each other.
     *
     * <p>The initial delay lets the context finish starting — including SES template provisioning —
     * before the first send.
     */
    @Scheduled(fixedDelayString = "${amldock.notifications.poll-ms:10000}",
               initialDelayString = "${amldock.notifications.initial-delay-ms:20000}")
    public void pump() {
        try {
            List<DealNotificationDispatchService.Sendable> batch = dispatch.claim(batchSize);
            if (batch.isEmpty()) return;

            log.debug("Sending {} deal notification(s)", batch.size());
            dispatch.applyOutcomes(dispatch.send(batch));
        } catch (Exception e) {
            // Never let a bad tick kill the schedule — Spring cancels a task that throws. Rows
            // claimed but not resolved are recovered by the lease arm of the claim query.
            log.error("Deal notification dispatch failed", e);
        }
    }

    /**
     * Clears delivered rows the audit trail already records. Hourly is far more often than a
     * 90-day window needs, which is the point: a cheap sweep that never has much to do beats one
     * that has to be scheduled carefully.
     */
    @Scheduled(fixedDelayString = "${amldock.notifications.purge-ms:3600000}",
               initialDelayString = "${amldock.notifications.purge-initial-delay-ms:60000}")
    public void purge() {
        try {
            int deleted = dispatch.purgeOldSent();
            if (deleted > 0) {
                log.info("Purged {} sent deal notification(s) past the retention window", deleted);
            }
        } catch (Exception e) {
            log.error("Could not purge sent deal notifications", e);
        }
    }
}
