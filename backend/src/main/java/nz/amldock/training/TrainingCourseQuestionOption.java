package nz.amldock.training;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

/**
 * One answer option. {@code correct} is the answer key — it is stripped from the payload for
 * anyone who isn't a training manager, so a course taker never receives it.
 */
@Entity
@Table(name = "training_course_question_option")
public class TrainingCourseQuestionOption extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "position", nullable = false)
    private Integer position;

    @Column(name = "label", nullable = false, columnDefinition = "text")
    private String label;

    @Column(name = "correct", nullable = false)
    private boolean correct;

    public Long getId() { return id; }
    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long v) { this.questionId = v; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer v) { this.position = v; }
    public String getLabel() { return label; }
    public void setLabel(String v) { this.label = v; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean v) { this.correct = v; }
}
