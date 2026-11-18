package nz.amldock.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** What JwtAuthenticationFilter checks a token against: two columns by primary key. */
    @Query("SELECT new nz.amldock.user.TokenState(u.tokenVersion, u.active) FROM User u WHERE u.id = :id")
    Optional<TokenState> findTokenState(@Param("id") Long id);

    /**
     * The user row, locked until the transaction ends. Membership changes take it first, so two
     * entities adding the same address at once cannot both see "no other active membership".
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
    List<User> findByRealEstateFirmIdOrderByIdAsc(Long realEstateFirmId);
    List<User> findByFirmBranchIdOrderByIdAsc(Long firmBranchId);

    /** Everyone active in a role — the recipients of a platform-wide notice such as a new query. */
    List<User> findByRoleAndActiveTrue(Role role);
}
