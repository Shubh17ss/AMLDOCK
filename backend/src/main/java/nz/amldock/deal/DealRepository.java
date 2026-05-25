package nz.amldock.deal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DealRepository extends JpaRepository<Deal, Long> {

    @Query("SELECT d FROM Deal d WHERE " +
            "(:status IS NULL OR d.status = :status) AND " +
            "(:createdByUserId IS NULL OR d.createdByUserId = :createdByUserId) AND " +
            "(:branchId IS NULL OR d.firmBranchId = :branchId) AND " +
            "(:firmId IS NULL OR d.firmBranchId IN " +
            "    (SELECT b.id FROM FirmBranch b WHERE b.realEstateFirmId = :firmId)) " +
            "ORDER BY d.createdAt DESC")
    List<Deal> search(@Param("status") DealStatus status,
                      @Param("createdByUserId") Long createdByUserId,
                      @Param("firmId") Long firmId,
                      @Param("branchId") Long branchId);
}
