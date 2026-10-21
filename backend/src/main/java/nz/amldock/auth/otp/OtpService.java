package nz.amldock.auth.otp;

import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/**
 * Issues and verifies one-time codes. Codes are 6 digits, hashed at rest, single-use, short-lived,
 * and capped by an attempts counter. Delivery goes through the existing {@link EmailService} (real
 * SMTP in prod, Mailpit in dev, logged when mail is off).
 *
 * <p>Failed attempts are counted by {@link OtpAttemptRecorder} rather than here — see that class for
 * why a counter incremented on this side of the call would never be persisted.
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RNG = new SecureRandom();

    private final OtpCodeRepository codes;
    private final OtpAttemptRecorder attempts;
    private final PasswordEncoder encoder;
    private final EmailService email;
    private final Duration ttl;
    private final int maxAttempts;
    private final int maxIssuesPerWindow;
    private final Duration issueWindow;
    private final int maxFailuresPerWindow;
    private final Duration failureWindow;

    /**
     * The limits are per account and purpose, not per code. A per-code cap alone was reset by
     * asking for a new code, which made the six digits guessable without bound (NV-03).
     */
    public OtpService(OtpCodeRepository codes,
                      OtpAttemptRecorder attempts,
                      PasswordEncoder encoder,
                      EmailService email,
                      @Value("${OTP_TTL_MINUTES:10}") long ttlMinutes,
                      @Value("${OTP_MAX_ATTEMPTS:5}") int maxAttempts,
                      @Value("${OTP_MAX_ISSUES_PER_WINDOW:5}") int maxIssuesPerWindow,
                      @Value("${OTP_ISSUE_WINDOW_MINUTES:15}") long issueWindowMinutes,
                      @Value("${OTP_MAX_FAILURES_PER_WINDOW:10}") int maxFailuresPerWindow,
                      @Value("${OTP_FAILURE_WINDOW_MINUTES:60}") long failureWindowMinutes) {
        this.codes = codes;
        this.attempts = attempts;
        this.encoder = encoder;
        this.email = email;
        this.ttl = Duration.ofMinutes(ttlMinutes);
        this.maxAttempts = maxAttempts;
        this.maxIssuesPerWindow = maxIssuesPerWindow;
        this.issueWindow = Duration.ofMinutes(issueWindowMinutes);
        this.maxFailuresPerWindow = maxFailuresPerWindow;
        this.failureWindow = Duration.ofMinutes(failureWindowMinutes);
    }

    /** Generate a fresh code (invalidating prior ones of this purpose), persist its hash, mail it. */
    @Transactional
    public void issue(User user, OtpPurpose purpose) {
        issueTo(user, purpose, user.getEmail());
    }

    /**
     * Issues a code to an address that is not the user's own.
     *
     * <p>Only {@link OtpPurpose#EMAIL_CHANGE} has any business here. The destination is stored on
     * the code, so verification can check that the address being claimed is the address the code was
     * actually sent to — see {@link OtpCode#getTargetEmail()}.
     *
     * <p>{@code consumeOutstanding} is scoped by purpose, so asking for one of these does not
     * silently kill a sign-in code the user is halfway through typing.
     */
    @Transactional
    public void issueTo(User user, OtpPurpose purpose, String destination) {
        // Each new code also kills the one the user is typing and sends them an email, so an
        // unbounded request rate is both a lockout and a mail flood.
        long recent = codes.countByUserIdAndPurposeAndCreatedAtAfter(
                user.getId(), purpose, Instant.now().minus(issueWindow));
        if (recent >= maxIssuesPerWindow) {
            log.warn("Refused {} OTP for user {}: {} issued in the last {} min",
                    purpose, user.getId(), recent, issueWindow.toMinutes());
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many codes requested — try again in a few minutes");
        }
        codes.consumeOutstanding(user.getId(), purpose, Instant.now());

        String code = String.format("%06d", RNG.nextInt(1_000_000));
        OtpCode otp = new OtpCode();
        otp.setUserId(user.getId());
        otp.setPurpose(purpose);
        otp.setCodeHash(encoder.encode(code));
        otp.setExpiresAt(Instant.now().plus(ttl));
        // Recorded only when it differs, so the two existing purposes stay exactly as they were.
        if (!destination.equalsIgnoreCase(user.getEmail())) {
            otp.setTargetEmail(destination);
        }
        codes.save(otp);

        email.send(render(destination, code, purpose));
        log.info("Issued {} OTP for user {}", purpose, user.getId());
    }

    /**
     * Verifies a submitted code for a user + purpose, consuming it on success.
     *
     * <p>Returns the consumed code so an {@code EMAIL_CHANGE} caller can read the address it was
     * bound to. Callers that only care whether it passed can ignore the return.
     *
     * <p>Every failure throws {@link BadRequestException} with the same message whether the code was
     * wrong, expired or absent — the caller has nothing to usefully distinguish, and neither does an
     * attacker.
     */
    @Transactional
    public OtpCode verify(User user, String submittedCode, OtpPurpose purpose) {
        OtpCode otp = codes
                .findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByIdDesc(user.getId(), purpose)
                .orElseThrow(() -> new BadRequestException("Invalid or expired code"));

        if (otp.isExpired()) {
            throw new BadRequestException("Invalid or expired code");
        }
        // The account's failure budget spans every code of this purpose, so a fresh code does not
        // bring a fresh set of guesses.
        long failures = codes.sumAttemptsSince(user.getId(), purpose, Instant.now().minus(failureWindow));
        if (failures >= maxFailuresPerWindow) {
            attempts.burn(otp.getId());
            log.warn("Refused {} OTP verify for user {}: {} failures in the last {} min",
                    purpose, user.getId(), failures, failureWindow.toMinutes());
            throw new BadRequestException("Too many attempts — try again later");
        }
        // Every write below goes through the recorder, in its own transaction. Writing to `otp`
        // here instead would look identical and do nothing: the throw rolls this transaction back.
        // The attempt is reserved before the (slow) hash check, so parallel guesses cannot all
        // slip under the cap.
        if (!attempts.reserveAttempt(otp.getId(), maxAttempts)) {
            attempts.burn(otp.getId());
            throw new BadRequestException("Too many attempts — request a new code");
        }
        if (!encoder.matches(submittedCode, otp.getCodeHash())) {
            throw new BadRequestException("Invalid or expired code");
        }
        if (!attempts.consume(otp.getId())) {
            // A concurrent request spent it first; a code is good for one sign-in.
            throw new BadRequestException("Invalid or expired code");
        }
        otp.setConsumedAt(Instant.now());
        return otp;
    }

    /* ---------- bodies ---------- */

    private EmailMessage render(String to, String code, OtpPurpose purpose) {
        return purpose == OtpPurpose.EMAIL_CHANGE ? renderEmailChange(to, code) : renderSignIn(to, code);
    }

    private EmailMessage renderSignIn(String to, String code) {
        String subject = "Your AMLDOCK sign-in code";
        String text = """
                Your AMLDOCK one-time sign-in code is: %s

                It expires in %d minutes. If you didn't request this, you can ignore this email.

                — AMLDOCK
                """.formatted(code, ttl.toMinutes());
        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 480px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">Your sign-in code</h2>
                  <p>Use this one-time code to finish signing in:</p>
                  <p style="font-size: 30px; font-weight: 800; letter-spacing: 6px; color:#1f4b7a; margin: 16px 0;">%s</p>
                  <p style="color:#6b7280; font-size: 13px;">It expires in %d minutes. If you didn't request this, you can ignore this email.</p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AMLDOCK</p>
                </body></html>
                """.formatted(code, ttl.toMinutes());
        return EmailMessage.of(to, subject, html, text);
    }

    /**
     * Deliberately different wording from the sign-in code.
     *
     * <p>This one lands in an inbox that has, most likely, never heard of AMLDOCK, and it says what
     * is being asked for — otherwise a stranger's six-digit code is indistinguishable from phishing.
     * It also tells someone who did not ask for it to do nothing, which is the correct response: an
     * unspent code changes nothing.
     */
    private EmailMessage renderEmailChange(String to, String code) {
        String subject = "Confirm your new AMLDOCK email address";
        String text = """
                Someone asked to use this address for their AMLDOCK account.

                Your confirmation code is: %s

                It expires in %d minutes. If this wasn't you, ignore this email — nothing changes
                until the code is entered.

                — AMLDOCK
                """.formatted(code, ttl.toMinutes());
        String html = """
                <!doctype html>
                <html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width: 480px; margin:0 auto; padding: 24px;">
                  <h2 style="color:#1f4b7a; margin-top:0;">Confirm your email address</h2>
                  <p>Someone asked to use this address for their AMLDOCK account. Enter this code to confirm it:</p>
                  <p style="font-size: 30px; font-weight: 800; letter-spacing: 6px; color:#1f4b7a; margin: 16px 0;">%s</p>
                  <p style="color:#6b7280; font-size: 13px;">It expires in %d minutes. If this wasn't you, ignore this email — nothing changes until the code is entered.</p>
                  <p style="color:#9ca3af; font-size: 12px; margin-top: 24px;">— AMLDOCK</p>
                </body></html>
                """.formatted(code, ttl.toMinutes());
        return EmailMessage.of(to, subject, html, text);
    }
}
