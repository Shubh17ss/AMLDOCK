package nz.amldock.beneficialowner;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BeneficialOwnerRepository extends JpaRepository<BeneficialOwner, Long> {
    List<BeneficialOwner> findAllByRealEstateFirmId(Long realEstateFirmId);
}
