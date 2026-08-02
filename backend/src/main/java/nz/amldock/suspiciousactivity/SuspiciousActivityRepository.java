package nz.amldock.suspiciousactivity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SuspiciousActivityRepository extends JpaRepository<SuspiciousActivity, Long> {

    /**
     * Register rows in one scope, newest suspicion first. Firm is matched exactly —
     * a null firm means the platform-level register. Branch narrows strictly to that
     * branch; no branch selected returns the whole firm's register (matching how the
     * compliance-document and fund-transaction lists behave).
     */
    @Query("""
            SELECT s FROM SuspiciousActivity s
            WHERE ((:firmId IS NULL AND s.realEstateFirmId IS NULL) OR s.realEstateFirmId = :firmId)
              AND (:branchId IS NULL OR s.firmBranchId = :branchId)
            ORDER BY s.dateOfSuspicion DESC, s.id DESC
            """)
    List<SuspiciousActivity> findAllScoped(@Param("firmId") Long firmId,
                                          @Param("branchId") Long branchId);
}
