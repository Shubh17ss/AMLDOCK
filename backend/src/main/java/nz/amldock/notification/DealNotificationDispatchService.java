package nz.amldock.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.email.BulkEmailSender;
import nz.amldock.email.ses.SesBulkEmailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Drains the notification outbox.
 *
 * <p><strong>The transaction boundaries are the design.</strong> Work happens in three phases and
 * the SES call sits outside every one of them. HikariCP runs a default pool of ten connections;
 * holding one open across a network round trip would starve the HTTP threads under any burst,
 * which is the failure this class is shaped to avoid. Same shape as
 * {@link nz.amldock.document.ocr.IdExtractionService}, for the same reason.
 *
 * <p>Orchestration lives in {@link ScheduledDealNotificationDispatcher} rather than here, because
 * calling one {@code @Transactional} method from another on the same bean bypasses Spring's proxy
 * and silently loses the transaction.
 *
 * <p>Claimed rows are grouped by (deal, event) so one SES {@code SendBulkEmail} carries a whole
 * event's recipients. Rows for an event are enqueued together and take adjacent ids, and the claim
 * query orders by id, so a batch usually arrives already grouped.
 */
@Service
public class DealNotificationDispatchService {

    private static final Logger log = LoggerFactory.getLogger(DealNotificationDispatchService.class);

    static final int MAX_ATTEMPTS = 4;

    /**
     * How long after a failure the next attempt becomes due, indexed by attempt number: 1 minute,
     * then 5, then 25. A fourth failure is terminal.
     */
    private static final Duration[] BACKOFF = {
            Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(25),
    };

    /** error is TEXT, but a stack-trace-length message helps nobody reading a queue row. */
    private static final int MAX_ERROR_LENGTH = 500;

    private final DealNotificationRepository notifications;
    private final BulkEmailSender sender;
    private final AuditService audit;
    private final ObjectMapper json;
    private final Duration lease;
    private final Duration retain;

    public DealNotificationDispatchService(
            DealNotificationRepository notifications,
            BulkEmailSender sender,
            AuditService audit,
            ObjectMapper json,
            @Value("${amldock.notifications.lease-minutes:5}") long leaseMinutes,
            @Value("${amldock.notifications.retain-days:90}") long retainDays) {
        this.notifications = notifications;
        this.sender = sender;
        this.audit = audit;
        this.json = json;
        this.lease = Duration.ofMinutes(leaseMinutes);
        this.retain = Duration.ofDays(retainDays);
    }

    /** What a worker needs to send one notification, read once so no entity is held open. */
    public record Sendable(Long id, Long dealId, DealNotificationEvent event,
                           Long recipientUserId, String recipientEmail,
                           Map<String, String> templateData) {}

    /** The result of one send, carried back to the row that produced it. */
    public record SendOutcome(Long id, Long dealId, Long recipientUserId, String recipientEmail,
                              boolean sent, boolean retryable, String messageId, String error) {}

    /* ---------- phase 1: claim ---------- */

    /**
     * Marks up to {@code batchSize} notifications as ours and returns them ready to send. Short by
     * construction — no network.
     */
    @Transactional
    public List<Sendable> claim(int batchSize) {
        Instant staleBefore = Instant.now().minus(lease);
        List<Long> ids = notifications.findClaimableIds(staleBefore, batchSize);
        if (ids.isEmpty()) return List.of();

        Instant now = Instant.now();
        List<Sendable> claimed = new ArrayList<>(ids.size());
        for (DealNotification n : notifications.findAllById(ids)) {
            if (n.getStatus() == DealNotificationStatus.IN_PROGRESS) {
                log.warn("Reclaiming notification {} — previous worker did not finish", n.getId());
            }
            n.setStatus(DealNotificationStatus.IN_PROGRESS);
            n.setClaimedAt(now);
            claimed.add(new Sendable(n.getId(), n.getDealId(), n.getEventType(),
                    n.getRecipientUserId(), n.getRecipientEmail(), templateData(n)));
        }
        return claimed;
    }

    /* ---------- phase 2: send (no transaction, no connection held) ---------- */

    /**
     * Sends a claimed batch, one SES call per (deal, event) group, chunked to the provider cap.
     *
     * <p>Never throws for one recipient: a per-entry problem becomes a failed outcome so the rest
     * of the batch still lands. A whole-call failure marks that chunk retryable, which is the right
     * answer for credentials, account-level throttling and network trouble alike.
     */
    public List<SendOutcome> send(List<Sendable> batch) {
        List<SendOutcome> outcomes = new ArrayList<>(batch.size());
        for (Map.Entry<GroupKey, List<Sendable>> group : groupByEvent(batch).entrySet()) {
            for (List<Sendable> chunk : chunk(group.getValue(),
                    SesBulkEmailSender.MAX_ENTRIES_PER_CALL)) {
                outcomes.addAll(sendChunk(group.getKey().event(), chunk));
            }
        }
        return outcomes;
    }

    private List<SendOutcome> sendChunk(DealNotificationEvent event, List<Sendable> chunk) {
        List<BulkEmailSender.BulkRecipient> recipients = chunk.stream()
                .map(s -> new BulkEmailSender.BulkRecipient(s.recipientEmail(), s.templateData()))
                .toList();

        List<BulkEmailSender.BulkSendOutcome> results;
        try {
            results = sender.sendBulk(event.templateName(), recipients);
        } catch (Exception e) {
            log.error("Bulk send failed for {} ({} recipients): {}",
                    event, chunk.size(), e.toString());
            return chunk.stream()
                    .map(s -> failed(s, true, e.toString()))
                    .toList();
        }

        if (results.size() != chunk.size()) {
            // Cannot tell which outcome belongs to which row, so nothing may be marked sent.
            // Retryable: a duplicate is benign, a silently dropped notification is not.
            log.error("Transport returned {} outcomes for {} recipients — retrying the chunk",
                    results.size(), chunk.size());
            return chunk.stream()
                    .map(s -> failed(s, true, "transport returned a mismatched result count"))
                    .toList();
        }

        List<SendOutcome> outcomes = new ArrayList<>(chunk.size());
        for (int i = 0; i < chunk.size(); i++) {
            Sendable s = chunk.get(i);
            BulkEmailSender.BulkSendOutcome r = results.get(i);
            outcomes.add(new SendOutcome(s.id(), s.dealId(), s.recipientUserId(),
                    s.recipientEmail(), r.sent(), r.retryable(), r.messageId(), r.error()));
        }
        return outcomes;
    }

    /* ---------- phase 3: record the outcome ---------- */

    @Transactional
    public void applyOutcomes(List<SendOutcome> outcomes) {
        for (SendOutcome o : outcomes) {
            DealNotification n = notifications.findById(o.id()).orElse(null);
            if (n == null) {
                log.warn("Notification {} vanished between claim and outcome", o.id());
                continue;
            }
            if (o.sent()) {
                markSent(n, o);
            } else {
                markFailed(n, o);
            }
        }
    }

    private void markSent(DealNotification n, SendOutcome o) {
        n.setStatus(DealNotificationStatus.SENT);
        n.setSentAt(Instant.now());
        n.setSesMessageId(o.messageId());
        n.setClaimedAt(null);
        n.setNextAttemptAt(null);
        n.setError(null);
        // recordForUser rather than record: this runs on the scheduler thread, where the security
        // context is empty, so record() would write a row with no actor at all. Same trap
        // TrainingNotifier documents.
        recordAudit(o, AuditAction.DEAL_NOTIFICATION_EMAIL_SENT,
                "Deal notification emailed to " + o.recipientEmail());
    }

    private void markFailed(DealNotification n, SendOutcome o) {
        int attempt = n.getAttemptCount() + 1;
        n.setAttemptCount(attempt);
        n.setError(truncate(o.error()));
        n.setClaimedAt(null);

        if (o.retryable() && attempt < MAX_ATTEMPTS) {
            n.setStatus(DealNotificationStatus.PENDING);
            n.setNextAttemptAt(Instant.now()
                    .plus(BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)]));
            // Not audited: a retry that then succeeds is noise in a compliance trail. Only the
            // terminal outcome is recorded — the same stance IdExtractionService takes.
            log.warn("Notification {} attempt {} failed, retrying: {}", n.getId(), attempt, o.error());
            return;
        }

        n.setStatus(DealNotificationStatus.FAILED);
        n.setNextAttemptAt(null);
        log.warn("Notification {} failed permanently after {} attempt(s): {}",
                n.getId(), attempt, o.error());
        recordAudit(o, AuditAction.DEAL_NOTIFICATION_EMAIL_FAILED,
                "Deal notification could not be delivered to " + o.recipientEmail()
                        + " after " + attempt + " attempt(s)");
    }

    /* ---------- retention ---------- */

    /**
     * Drops delivered rows past the retention window. Their outcome already lives on the audit
     * trail, so the row is redundant; without this the table only grows. FAILED rows stay.
     */
    @Transactional
    public int purgeOldSent() {
        return notifications.purgeSentBefore(Instant.now().minus(retain));
    }

    /* ---------- helpers ---------- */

    /** An outcome for a row the transport never got to judge individually. */
    private static SendOutcome failed(Sendable s, boolean retryable, String error) {
        return new SendOutcome(s.id(), s.dealId(), s.recipientUserId(), s.recipientEmail(),
                false, retryable, null, error);
    }

    private record GroupKey(Long dealId, DealNotificationEvent event) {}

    /** Preserves claim order, so grouping never reorders a batch relative to its ids. */
    private static Map<GroupKey, List<Sendable>> groupByEvent(List<Sendable> batch) {
        Map<GroupKey, List<Sendable>> grouped = new LinkedHashMap<>();
        for (Sendable s : batch) {
            grouped.computeIfAbsent(new GroupKey(s.dealId(), s.event()), k -> new ArrayList<>())
                    .add(s);
        }
        return grouped;
    }

    static <T> List<List<T>> chunk(List<T> items, int size) {
        List<List<T>> chunks = new ArrayList<>();
        for (int i = 0; i < items.size(); i += size) {
            chunks.add(items.subList(i, Math.min(i + size, items.size())));
        }
        return chunks;
    }

    private Map<String, String> templateData(DealNotification n) {
        try {
            DealNotificationPayload payload =
                    json.readValue(n.getPayload(), DealNotificationPayload.class);
            return payload.toTemplateData();
        } catch (Exception e) {
            // A payload we cannot read will never become readable, so there is nothing to retry.
            // Empty data still renders the template, which is a poor email but a delivered one —
            // and the row records what happened either way.
            log.error("Could not read payload for notification {}: {}", n.getId(), e.toString());
            return Map.of();
        }
    }

    private void recordAudit(SendOutcome o, AuditAction action, String summary) {
        try {
            audit.recordForUser(o.recipientUserId(), o.recipientEmail(), action,
                    "Deal", o.dealId(), summary);
        } catch (Exception e) {
            // Never let the audit write undo the queue write it is describing.
            log.warn("Could not write notification audit for {}: {}",
                    o.recipientEmail(), e.getMessage());
        }
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= MAX_ERROR_LENGTH ? s : s.substring(0, MAX_ERROR_LENGTH);
    }
}
