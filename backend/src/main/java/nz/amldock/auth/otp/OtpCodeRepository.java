package nz.amldock.auth.otp;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface OtpCodeRepository extends JpaRepository<OtpCode, Long> {

    /** The most recent still-usable code for a user + purpose. */
    Optional<OtpCode> findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByIdDesc(Long userId, OtpPurpose purpose);

    /** Invalidate any outstanding codes so only the freshly-issued one is valid. */
    @Modifying
    @Query("UPDATE OtpCode o SET o.consumedAt = :now " +
            "WHERE o.userId = :userId AND o.purpose = :purpose AND o.consumedAt IS NULL")
    void consumeOutstanding(@Param("userId") Long userId,
                            @Param("purpose") OtpPurpose purpose,
                            @Param("now") Instant now);

    /** How many codes of this purpose the user has been sent since {@code since}. */
    long countByUserIdAndPurposeAndCreatedAtAfter(Long userId, OtpPurpose purpose, Instant since);

    /**
     * Failed guesses across every code of this purpose since {@code since}. A successful use gives
     * its reserved attempt back ({@link #consumeReserved}), so this counts failures only.
     */
    @Query("SELECT COALESCE(SUM(o.attempts), 0) FROM OtpCode o " +
            "WHERE o.userId = :userId AND o.purpose = :purpose AND o.createdAt >= :since")
    long sumAttemptsSince(@Param("userId") Long userId,
                          @Param("purpose") OtpPurpose purpose,
                          @Param("since") Instant since);

    /**
     * Takes one attempt from the code's budget, atomically. Returns 0 when the budget is spent,
     * so concurrent guesses cannot all pass a stale check.
     */
    @Modifying
    @Query("UPDATE OtpCode o SET o.attempts = o.attempts + 1 " +
            "WHERE o.id = :id AND o.attempts < :max AND o.consumedAt IS NULL")
    int reserveAttempt(@Param("id") Long id, @Param("max") int max);

    /**
     * Spends a code on a correct guess and returns the attempt it reserved. Returns 0 when another
     * request already used it.
     */
    @Modifying
    @Query("UPDATE OtpCode o SET o.consumedAt = :now, o.attempts = o.attempts - 1 " +
            "WHERE o.id = :id AND o.consumedAt IS NULL")
    int consumeReserved(@Param("id") Long id, @Param("now") Instant now);
}
