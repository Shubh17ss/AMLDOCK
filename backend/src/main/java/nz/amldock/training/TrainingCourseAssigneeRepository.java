package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TrainingCourseAssigneeRepository extends JpaRepository<TrainingCourseAssignee, Long> {

    List<TrainingCourseAssignee> findAllByTrainingCourseId(Long trainingCourseId);

    /** Batch-load for a list page. */
    List<TrainingCourseAssignee> findAllByTrainingCourseIdIn(Collection<Long> trainingCourseIds);

    List<TrainingCourseAssignee> findAllByUserId(Long userId);

    Optional<TrainingCourseAssignee> findByTrainingCourseIdAndUserId(Long trainingCourseId, Long userId);

    void deleteAllByTrainingCourseId(Long trainingCourseId);
}
