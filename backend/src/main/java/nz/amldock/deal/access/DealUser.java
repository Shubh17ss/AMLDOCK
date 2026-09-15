package nz.amldock.deal.access;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * An agent let onto a deal they did not create.
 *
 * <p>{@code DealLifecycleService.assertCanRead} confines AGENT and AGENT_PA to their own deals,
 * which is the right default and a dead end when two of them work one file. This table is the
 * exception, and it only ever <em>adds</em>: a row here grants access, and its absence leaves the
 * existing rules exactly as they were. Nobody's branch- or firm-level reach is affected, so there
 * is nothing to backfill and no way for this to take access away.
 *
 * <p>Not the assignment column V29 deleted. That one named the single compliance reviewer a deal
 * belonged to, and contradicted the rule that any compliance officer of the firm may act on any of
 * its deals. This is the other axis — which agents can reach the deal at all — and it says nothing
 * about who owns the review.
 */
@Entity
@Table(name = "deal_user")
public class DealUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false, updatable = false)
    private Long dealId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    /** Who granted it. Kept on the row so the answer travels with the grant. */
    @Column(name = "added_by_user_id", nullable = false, updatable = false)
    private Long addedByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected DealUser() { }

    public DealUser(Long dealId, Long userId, Long addedByUserId) {
        this.dealId = dealId;
        this.userId = userId;
        this.addedByUserId = addedByUserId;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public Long getUserId() { return userId; }
    public Long getAddedByUserId() { return addedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
}
