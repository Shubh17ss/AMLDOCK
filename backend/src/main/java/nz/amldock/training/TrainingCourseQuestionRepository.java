package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TrainingCourseQuestionRepository extends JpaRepository<TrainingCourseQuestion, Long> {

    List<TrainingCourseQuestion> findAllByTrainingCourseIdOrderByPositionAsc(Long trainingCourseId);

    /** Batch-load for a list page. */
    List<TrainingCourseQuestion> findAllByTrainingCourseIdInOrderByPositionAsc(
            Collection<Long> trainingCourseIds);

    void deleteAllByTrainingCourseId(Long trainingCourseId);
}
