package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TrainingCourseQuestionOptionRepository
        extends JpaRepository<TrainingCourseQuestionOption, Long> {

    List<TrainingCourseQuestionOption> findAllByQuestionIdInOrderByPositionAsc(Collection<Long> questionIds);

    void deleteAllByQuestionIdIn(Collection<Long> questionIds);
}
