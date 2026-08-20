package nz.amldock.beneficialowner;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DealBeneficialOwnerRepository
        extends JpaRepository<DealBeneficialOwner, DealBeneficialOwner.Key> {

    List<DealBeneficialOwner> findAllByDealIdOrderByCreatedAtAsc(Long dealId);

    /** How many deals a person still appears on — served by idx_dbo_owner. */
    long countByBeneficialOwnerId(Long beneficialOwnerId);

    void deleteAllByDealId(Long dealId);
}
