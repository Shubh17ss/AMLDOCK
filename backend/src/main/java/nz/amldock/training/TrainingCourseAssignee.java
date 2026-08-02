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
 * One staff member's assignment to a course — the same link-row shape as
 * {@link TrainingSessionAttendee}.
 *
 * {@code completedAt} stays null until the course-taker side is built; it is here because
 * assignment without a completion column would need a migration the moment that work starts.
 */
@Entity
@Table(name = "training_course_assignee")
public class TrainingCourseAssignee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "training_course_id", nullable = false)
    private Long trainingCourseId;

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
    public Long getTrainingCourseId() { return trainingCourseId; }
    public void setTrainingCourseId(Long v) { this.trainingCourseId = v; }
    public Long getUserId() { return userId; }
    public void setUserId(Long v) { this.userId = v; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant v) { this.completedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
}
