package nz.amldock.training;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

/** One question in a course's questionnaire. Position is assigned server-side from list order. */
@Entity
@Table(name = "training_course_question")
public class TrainingCourseQuestion extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "training_course_id", nullable = false)
    private Long trainingCourseId;

    @Column(name = "position", nullable = false)
    private Integer position;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false, length = 32)
    private QuestionType questionType;

    @Column(name = "prompt", nullable = false, columnDefinition = "text")
    private String prompt;

    public Long getId() { return id; }
    public Long getTrainingCourseId() { return trainingCourseId; }
    public void setTrainingCourseId(Long v) { this.trainingCourseId = v; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer v) { this.position = v; }
    public QuestionType getQuestionType() { return questionType; }
    public void setQuestionType(QuestionType v) { this.questionType = v; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String v) { this.prompt = v; }
}
