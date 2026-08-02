package nz.amldock.training;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One staff member's assignment to a training session. A link row in the style of
 * {@link nz.amldock.ownership.OwnershipEdge} — two scalar FKs and a UNIQUE pair — so it carries
 * its own createdAt rather than extending BaseEntity.
 *
 * Completion is simply {@code completedAt != null}; there is no separate status column.
 */
@Entity
@Table(name = "training_session_attendee")
public class TrainingSessionAttendee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "training_session_id", nullable = false)
    private Long trainingSessionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getTrainingSessionId() { return trainingSessionId; }
    public void setTrainingSessionId(Long v) { this.trainingSessionId = v; }
    public Long getUserId() { return userId; }
    public void setUserId(Long v) { this.userId = v; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant v) { this.completedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
}
