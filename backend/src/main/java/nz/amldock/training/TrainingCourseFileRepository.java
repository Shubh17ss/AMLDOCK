package nz.amldock.training;

import nz.amldock.document.DocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TrainingCourseFileRepository extends JpaRepository<TrainingCourseFile, Long> {

    List<TrainingCourseFile> findAllByTrainingCourseIdOrderByIdAsc(Long trainingCourseId);

    List<TrainingCourseFile> findAllByTrainingCourseIdAndDocumentStatusOrderByIdAsc(
            Long trainingCourseId, DocumentStatus documentStatus);

    /** Batch-load for a list page — one query for every course's content. */
    List<TrainingCourseFile> findAllByTrainingCourseIdInAndDocumentStatus(
            Collection<Long> trainingCourseIds, DocumentStatus documentStatus);

    void deleteAllByTrainingCourseId(Long trainingCourseId);
}
