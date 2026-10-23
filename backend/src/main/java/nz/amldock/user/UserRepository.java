package nz.amldock.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** What JwtAuthenticationFilter checks a token against: two columns by primary key. */
    @Query("SELECT new nz.amldock.user.TokenState(u.tokenVersion, u.active) FROM User u WHERE u.id = :id")
    Optional<TokenState> findTokenState(@Param("id") Long id);

    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
    List<User> findByRealEstateFirmIdOrderByIdAsc(Long realEstateFirmId);
    List<User> findByFirmBranchIdOrderByIdAsc(Long firmBranchId);
}
