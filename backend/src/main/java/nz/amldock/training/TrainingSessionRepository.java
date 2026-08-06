package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TrainingSessionRepository extends JpaRepository<TrainingSession, Long> {

    /** Sessions in one scope, soonest first — the session date is required, so it always sorts. */
    @Query("""
            SELECT s FROM TrainingSession s
            WHERE ((:firmId IS NULL AND s.realEstateFirmId IS NULL) OR s.realEstateFirmId = :firmId)
              AND (:branchId IS NULL OR s.firmBranchId = :branchId)
            ORDER BY s.sessionDate ASC, s.id DESC
            """)
    List<TrainingSession> findAllScoped(@Param("firmId") Long firmId,
                                       @Param("branchId") Long branchId);

    /** The personal view: only the sessions a user is actually assigned to. */
    @Query("""
            SELECT s FROM TrainingSession s
            WHERE s.id IN :ids
            ORDER BY s.sessionDate ASC, s.id DESC
            """)
    List<TrainingSession> findAllByIdInOrdered(@Param("ids") Collection<Long> ids);

    boolean existsByTrainingProviderId(Long trainingProviderId);
}
