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
}
