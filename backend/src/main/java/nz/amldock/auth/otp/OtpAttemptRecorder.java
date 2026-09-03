package nz.amldock.auth.otp;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Persists what a <em>failed</em> verification learned, in a transaction of its own.
 *
 * <p>This exists because of how {@link OtpService#verify} reports failure. It signals every failure
 * by throwing, and a {@code RuntimeException} out of a {@code @Transactional} method marks that
 * transaction rollback-only — so the {@code attempts + 1} written moments earlier was rolled back
 * with it. The counter never left zero, which meant the max-attempts cap never fired and a
 * six-digit code was open to brute force for its whole ten-minute life.
 *
 * <p>{@code REQUIRES_NEW} suspends the caller's transaction and commits this one on its own, so the
 * increment survives the exception that follows it.
 *
 * <p>It is a separate bean rather than a method on {@link OtpService} because Spring's
 * {@code @Transactional} is proxy-based: a self-invocation would not pass through the proxy and the
 * annotation would be silently ignored — reintroducing exactly the bug this class fixes, in a form
 * that looks correct.
 */
@Component
class OtpAttemptRecorder {

    private final OtpCodeRepository codes;

    OtpAttemptRecorder(OtpCodeRepository codes) {
        this.codes = codes;
    }

    /** Counts one wrong guess. Flushed, not merely saved, so the commit cannot be deferred. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordFailedAttempt(Long otpId) {
        codes.findById(otpId).ifPresent(otp -> {
            otp.setAttempts(otp.getAttempts() + 1);
            codes.saveAndFlush(otp);
        });
    }

    /** Burns a code that has run out of attempts, so retrying cannot revive it. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void burn(Long otpId) {
        codes.findById(otpId).ifPresent(otp -> {
            otp.setConsumedAt(Instant.now());
            codes.saveAndFlush(otp);
        });
    }
}
