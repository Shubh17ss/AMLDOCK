package nz.amldock.firm;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FirmBranchRepository extends JpaRepository<FirmBranch, Long> {
    List<FirmBranch> findAllByRealEstateFirmIdOrderByNameAsc(Long firmId);
    Optional<FirmBranch> findByRealEstateFirmIdAndNameIgnoreCase(Long firmId, String name);
}
