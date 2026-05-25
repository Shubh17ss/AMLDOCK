package nz.amldock.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OwnershipStructureRepository extends JpaRepository<OwnershipStructure, Long> {
    Optional<OwnershipStructure> findByDealId(Long dealId);
}
