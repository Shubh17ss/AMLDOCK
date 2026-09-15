package nz.amldock.deal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DealRepository extends JpaRepository<Deal, Long> {

    /**
     * The deals one actor may see, already narrowed by {@code DealService.readableDeals}.
     *
     * <p>{@code createdByUserId} is the agent scope, and it reads as "authored by them <em>or</em>
     * shared with them" — the set-level twin of the grant {@code DealLifecycleService.assertCanRead}
     * consults for a single deal. Written as one predicate rather than a second query so paging and
     * ordering stay in one place; the subquery hits {@code uq_deal_user}.
     */
    @Query("SELECT d FROM Deal d WHERE " +
            "(:status IS NULL OR d.status = :status) AND " +
            "(:createdByUserId IS NULL OR d.createdByUserId = :createdByUserId OR d.id IN " +
            "    (SELECT du.dealId FROM DealUser du WHERE du.userId = :createdByUserId)) AND " +
            "(:branchId IS NULL OR d.firmBranchId = :branchId) AND " +
            "(:firmId IS NULL OR d.firmBranchId IN " +
            "    (SELECT b.id FROM FirmBranch b WHERE b.realEstateFirmId = :firmId)) " +
            "ORDER BY d.createdAt DESC")
    List<Deal> search(@Param("status") DealStatus status,
                      @Param("createdByUserId") Long createdByUserId,
                      @Param("firmId") Long firmId,
                      @Param("branchId") Long branchId);
}
