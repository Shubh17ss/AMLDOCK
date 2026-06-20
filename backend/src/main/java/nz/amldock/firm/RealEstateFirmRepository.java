package nz.amldock.firm;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RealEstateFirmRepository extends JpaRepository<RealEstateFirm, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    boolean existsByNzbnIgnoreCase(String nzbn);
    boolean existsByNzbnIgnoreCaseAndIdNot(String nzbn, Long id);
    Optional<RealEstateFirm> findByNameIgnoreCase(String name);
    List<RealEstateFirm> findAllByOrderByNameAsc();
}
