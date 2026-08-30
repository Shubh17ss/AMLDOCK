package nz.amldock.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * One queued email to one recipient about one deal event — the outbox row.
 *
 * <p>Written in the deal's own transaction by {@link DealNotificationEnqueuer} and drained by
 * {@link ScheduledDealNotificationDispatcher}. One row per recipient rather than per event, which
 * is what gives per-recipient retry, a per-recipient audit trail, and a personalised body.
 * Batching is the dispatcher's business: it groups claimed rows back together for a single SES
 * call, so the granularity here costs nothing.
 *
 * <p>Deliberately does not extend {@link nz.amldock.common.audit.BaseEntity} — the row has a
 * meaningful {@code createdAt} but no meaningful {@code updatedAt}, and the queue columns
 * ({@code attemptCount}, {@code claimedAt}, {@code sentAt}) already say when anything happened.
 */
@Entity
@Table(name = "deal_notification")
public class DealNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false)
    private Long dealId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 48)
    private DealNotificationEvent eventType;

    @Column(name = "recipient_user_id", nullable = false)
    private Long recipientUserId;

    /** Snapshotted so a later address change cannot redirect an email about a past event. */
    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;

    /** Serialised {@link DealNotificationPayload}. See that record for why it is a snapshot. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DealNotificationStatus status = DealNotificationStatus.PENDING;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 0;

    /** When this row next becomes eligible. NULL means immediately. */
    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    /** Set on claim; its age is what makes a dead worker's claim collectable. */
    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(columnDefinition = "text")
    private String error;

    @Column(name = "ses_message_id")
    private String sesMessageId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public void setDealId(Long dealId) { this.dealId = dealId; }
    public DealNotificationEvent getEventType() { return eventType; }
    public void setEventType(DealNotificationEvent eventType) { this.eventType = eventType; }
    public Long getRecipientUserId() { return recipientUserId; }
    public void setRecipientUserId(Long recipientUserId) { this.recipientUserId = recipientUserId; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public DealNotificationStatus getStatus() { return status; }
    public void setStatus(DealNotificationStatus status) { this.status = status; }
    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(Instant nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    public Instant getClaimedAt() { return claimedAt; }
    public void setClaimedAt(Instant claimedAt) { this.claimedAt = claimedAt; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public String getSesMessageId() { return sesMessageId; }
    public void setSesMessageId(String sesMessageId) { this.sesMessageId = sesMessageId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
}
