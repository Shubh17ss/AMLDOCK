package nz.amldock.deal.assurance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AssuranceIssueRepository extends JpaRepository<AssuranceIssue, Long> {

    List<AssuranceIssue> findAllByDealVersionIdOrderBySortOrderAsc(Long dealVersionId);

    /** Every issue on every version in a list, in one query — the register's rows. */
    List<AssuranceIssue> findAllByDealVersionIdInOrderBySortOrderAsc(Collection<Long> dealVersionIds);

    /** A bulk delete, so the replacement rows can reuse sort orders inside the same transaction. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from AssuranceIssue i where i.dealVersionId = :versionId")
    void deleteAllForVersion(@Param("versionId") Long versionId);
}
