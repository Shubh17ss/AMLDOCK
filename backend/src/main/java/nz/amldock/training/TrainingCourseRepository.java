package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TrainingCourseRepository extends JpaRepository<TrainingCourse, Long> {

    /** Courses in one scope, soonest due first; undated courses sort last. */
    @Query("""
            SELECT c FROM TrainingCourse c
            WHERE ((:firmId IS NULL AND c.realEstateFirmId IS NULL) OR c.realEstateFirmId = :firmId)
              AND (:branchId IS NULL OR c.firmBranchId = :branchId)
            ORDER BY CASE WHEN c.dueDate IS NULL THEN 1 ELSE 0 END ASC, c.dueDate ASC, c.id DESC
            """)
    List<TrainingCourse> findAllScoped(@Param("firmId") Long firmId,
                                       @Param("branchId") Long branchId);

    /** The personal view: only the courses a user is actually assigned to. */
    @Query("""
            SELECT c FROM TrainingCourse c
            WHERE c.id IN :ids
            ORDER BY CASE WHEN c.dueDate IS NULL THEN 1 ELSE 0 END ASC, c.dueDate ASC, c.id DESC
            """)
    List<TrainingCourse> findAllByIdInOrdered(@Param("ids") Collection<Long> ids);
}
