package nz.amldock.auth.otp;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/**
 * Issues and verifies one-time login codes. Codes are 6 digits, hashed at rest, single-use,
 * short-lived, and rate-limited by a max-attempts counter. Delivery goes through the existing
 * {@link EmailService} (real SMTP in prod, logged in dev).
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RNG = new SecureRandom();

    private final OtpCodeRepository codes;
    private final PasswordEncoder encoder;
    private final EmailService email;
    private final Duration ttl;
    private final int maxAttempts;

    public OtpService(OtpCodeRepository codes,
                      PasswordEncoder encoder,
                      EmailService email,
                      @Value("${OTP_TTL_MINUTES:10}") long ttlMinutes,
                      @Value("${OTP_MAX_ATTEMPTS:5}") int maxAttempts) {
        this.codes = codes;
        this.encoder = encoder;
        this.email = email;
        this.ttl = Duration.ofMinutes(ttlMinutes);
        this.maxAttempts = maxAttempts;
    }

    /** Generate a fresh code (invalidating prior ones), persist its hash, and email it. */
    @Transactional
    public void issue(User user, OtpPurpose purpose) {
        codes.consumeOutstanding(user.getId(), purpose, Instant.now());

        String code = String.format("%06d", RNG.nextInt(1_000_000));
        OtpCode otp = new OtpCode();
        otp.setUserId(user.getId());
        otp.setPurpose(purpose);
        otp.setCodeHash(encoder.encode(code));
        otp.setExpiresAt(Instant.now().plus(ttl));
        codes.save(otp);

        email.send(render(user.getEmail(), code));
        log.info("Issued {} OTP for user {}", purpose, user.getEmail());
    }

    /**
     * Verify a submitted code for a user + purpose. On success the code is consumed (single-use).
     * Throws {@link BadRequestException} on any failure (no distinction between wrong/expired/missing
     * so callers can surface a single generic message).
     */
    @Transactional
    public void verify(User user, String submittedCode, OtpPurpose purpose) {
        OtpCode otp = codes
                .findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByIdDesc(user.getId(), purpose)
                .orElseThrow(() -> new BadRequestException("Invalid or expired code"));

        if (otp.isExpired()) {
            throw new BadRequestException("Invalid or expired code");
        }
        if (otp.getAttempts() >= maxAttempts) {
            otp.setConsumedAt(Instant.now()); // burn it
            throw new BadRequestException("Too many attempts — request a new code");
        }
        if (!encoder.matches(submittedCode, otp.getCodeHash())) {
            otp.setAttempts(otp.getAttempts() + 1);
            throw new BadRequestException("Invalid or expired code");
        }
        otp.setConsumedAt(Instant.now());
    }

    private EmailMessage render(String to, String code) {
        String subject = "Your AML_DOCK sign-in code";
        String text = """
                Your AML_DOCK one-time sign-in code is: %s

                It expires in %d minutes. If you didn't request this, you can ignore this email.

                — AML_DOCK
                """.formatted(code, ttl.toMinutes());
        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 480px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">Your sign-in code</h2>
                  <p>Use this one-time code to finish signing in:</p>
                  <p style="font-size: 30px; font-weight: 800; letter-spacing: 6px; color:#1f4b7a; margin: 16px 0;">%s</p>
                  <p style="color:#6b7280; font-size: 13px;">It expires in %d minutes. If you didn't request this, you can ignore this email.</p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AML_DOCK</p>
                </body></html>
                """.formatted(code, ttl.toMinutes());
        return EmailMessage.of(to, subject, html, text);
    }
}
