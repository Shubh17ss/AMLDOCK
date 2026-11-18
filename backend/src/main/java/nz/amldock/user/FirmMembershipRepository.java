package nz.amldock.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FirmMembershipRepository extends JpaRepository<FirmMembership, Long> {

    List<FirmMembership> findByUserIdOrderByIdAsc(Long userId);
    List<FirmMembership> findByUserIdAndActiveTrueOrderByIdAsc(Long userId);
    List<FirmMembership> findByUserIdIn(Collection<Long> userIds);
    Optional<FirmMembership> findByUserIdAndRealEstateFirmId(Long userId, Long realEstateFirmId);

    List<FirmMembership> findByRealEstateFirmIdOrderByUserIdAsc(Long realEstateFirmId);
    List<FirmMembership> findByFirmBranchIdOrderByUserIdAsc(Long firmBranchId);
}
