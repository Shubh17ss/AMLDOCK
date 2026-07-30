package nz.amldock.fundtransaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InternationalFundTransactionRepository extends JpaRepository<InternationalFundTransaction, Long> {

    /**
     * Register rows in one scope, newest transaction first. Firm is matched exactly —
     * a null firm means the platform-level register. Branch narrows strictly to that
     * branch; no branch selected returns the whole firm's register (matching how the
     * compliance-document lists behave).
     */
    @Query("""
            SELECT t FROM InternationalFundTransaction t
            WHERE ((:firmId IS NULL AND t.realEstateFirmId IS NULL) OR t.realEstateFirmId = :firmId)
              AND (:branchId IS NULL OR t.firmBranchId = :branchId)
            ORDER BY t.transactionDate DESC, t.id DESC
            """)
    List<InternationalFundTransaction> findAllScoped(@Param("firmId") Long firmId,
                                                    @Param("branchId") Long branchId);
}
