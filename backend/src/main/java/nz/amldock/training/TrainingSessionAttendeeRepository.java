package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TrainingSessionAttendeeRepository extends JpaRepository<TrainingSessionAttendee, Long> {

    List<TrainingSessionAttendee> findAllByTrainingSessionId(Long trainingSessionId);

    /** Batch-load for a list page — one query for every session's roster. */
    List<TrainingSessionAttendee> findAllByTrainingSessionIdIn(Collection<Long> trainingSessionIds);

    List<TrainingSessionAttendee> findAllByUserId(Long userId);

    Optional<TrainingSessionAttendee> findByTrainingSessionIdAndUserId(Long trainingSessionId, Long userId);

    void deleteAllByTrainingSessionId(Long trainingSessionId);
}
