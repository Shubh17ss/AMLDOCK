package nz.amldock.compliancedoc;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DocumentReviewRepository extends JpaRepository<DocumentReview, Long> {

    // Null-safe scope match: a null firm/branch parameter matches the row whose column is
    // also null (the platform / firm-wide register), not "= null".
    @Query("""
            SELECT r FROM DocumentReview r
            WHERE r.moduleKey = :moduleKey
              AND ((:firmId IS NULL AND r.realEstateFirmId IS NULL) OR r.realEstateFirmId = :firmId)
              AND ((:branchId IS NULL AND r.firmBranchId IS NULL) OR r.firmBranchId = :branchId)
            """)
    Optional<DocumentReview> findScoped(@Param("moduleKey") String moduleKey,
                                        @Param("firmId") Long firmId,
                                        @Param("branchId") Long branchId);

    @Query("""
            SELECT r FROM DocumentReview r
            WHERE ((:firmId IS NULL AND r.realEstateFirmId IS NULL) OR r.realEstateFirmId = :firmId)
              AND ((:branchId IS NULL AND r.firmBranchId IS NULL) OR r.firmBranchId = :branchId)
            """)
    List<DocumentReview> findAllScoped(@Param("firmId") Long firmId,
                                       @Param("branchId") Long branchId);
}
