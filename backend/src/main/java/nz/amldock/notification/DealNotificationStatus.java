package nz.amldock.notification;

/**
 * Where an outbox row sits. Mirrors {@link nz.amldock.document.OcrStatus}, which is the same queue
 * shape.
 */
public enum DealNotificationStatus {
    /** Enqueued in the deal's own transaction, waiting to be claimed. */
    PENDING,
    /** Claimed by a worker. A claim older than the lease is treated as abandoned and re-collected. */
    IN_PROGRESS,
    /** SES accepted it. Redundant once the audit row exists, so the retention sweep clears these. */
    SENT,
    /** Gave up — a permanent SES status, or the retry ladder ran out. Reason in {@code error}. */
    FAILED
}
