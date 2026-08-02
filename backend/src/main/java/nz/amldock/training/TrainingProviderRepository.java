package nz.amldock.training;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TrainingProviderRepository extends JpaRepository<TrainingProvider, Long> {

    /** Providers in one scope, alphabetical. Same scoping idiom as the monitoring registers. */
    @Query("""
            SELECT p FROM TrainingProvider p
            WHERE ((:firmId IS NULL AND p.realEstateFirmId IS NULL) OR p.realEstateFirmId = :firmId)
              AND (:branchId IS NULL OR p.firmBranchId = :branchId)
            ORDER BY LOWER(p.name) ASC
            """)
    List<TrainingProvider> findAllScoped(@Param("firmId") Long firmId,
                                        @Param("branchId") Long branchId);

    boolean existsByRealEstateFirmIdAndFirmBranchIdAndNameIgnoreCase(Long realEstateFirmId,
                                                                    Long firmBranchId,
                                                                    String name);
}
