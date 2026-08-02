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
 * {@code completedAt} is set when — and only when — the user passes the assessment, so a course
 * they later retook out of interest stays done. {@code scorePercent} and {@code passed} are boxed
 * because null carries meaning here: never attempted, which the UI shows differently from a
 * recorded fail.
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

    /** Latest attempt's score, 0-100. Null until they have sat the assessment at all. */
    @Column(name = "score_percent")
    private Integer scorePercent;

    @Column(name = "passed")
    private Boolean passed;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

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
    public Integer getScorePercent() { return scorePercent; }
    public void setScorePercent(Integer v) { this.scorePercent = v; }
    public Boolean getPassed() { return passed; }
    public void setPassed(Boolean v) { this.passed = v; }
    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int v) { this.attemptCount = v; }
    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(Instant v) { this.lastAttemptAt = v; }
    public Instant getCreatedAt() { return createdAt; }
}
