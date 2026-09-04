package nz.amldock.auth.otp;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The code lifecycle, and in particular the attempt cap.
 *
 * <p>That cap did not work. {@code verify} is {@code @Transactional} and reports every failure by
 * throwing, so the {@code attempts + 1} it wrote first was rolled back with the exception — the
 * counter never left zero, the limit never fired, and a six-digit code was open to brute force for
 * its whole ten-minute life. The fix moved the bookkeeping to {@link OtpAttemptRecorder}, and the
 * tests here pin the behaviour that proves it: a failure must <em>record</em> something.
 *
 * <p>A real {@code BCryptPasswordEncoder} rather than a mock, because "does the submitted code
 * match the stored hash" is the one thing this class actually decides.
 */
@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    static final Long USER_ID = 7L;

    @Mock OtpCodeRepository codes;
    @Mock OtpAttemptRecorder attempts;
    @Mock EmailService email;

    final PasswordEncoder encoder = new BCryptPasswordEncoder(4); // low cost: this runs per assertion

    OtpService service;
    User user;

    @BeforeEach
    void setUp() {
        service = new OtpService(codes, attempts, encoder, email, 10, 5);
        user = new User();
        ReflectionTestUtils.setField(user, "id", USER_ID);
        user.setEmail("agent@firm.nz");
        user.setFullName("An Agent");
        user.setRole(Role.AGENT);
        lenient().when(email.send(any())).thenReturn(CompletableFuture.completedFuture(true));
        lenient().when(codes.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    /** A code stored so that `raw` verifies against it. */
    private OtpCode existing(String raw, int priorAttempts) {
        OtpCode otp = new OtpCode();
        ReflectionTestUtils.setField(otp, "id", 100L);
        otp.setUserId(USER_ID);
        otp.setPurpose(OtpPurpose.LOGIN);
        otp.setCodeHash(encoder.encode(raw));
        otp.setAttempts(priorAttempts);
        otp.setExpiresAt(Instant.now().plusSeconds(600));
        when(codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByIdDesc(USER_ID, OtpPurpose.LOGIN))
                .thenReturn(Optional.of(otp));
        return otp;
    }

    /* ---------- the cap ---------- */

    /**
     * The regression test for the whole bug. Before the fix nothing was recorded at all, because
     * the throw took the increment with it.
     */
    @Test
    void aWrongCodeRecordsTheAttemptThroughTheRecorder() {
        OtpCode otp = existing("123456", 0);

        assertThatThrownBy(() -> service.verify(user, "000000", OtpPurpose.LOGIN))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid or expired code");

        // Recorded out-of-band, in a transaction the caller's rollback cannot reach.
        verify(attempts).recordFailedAttempt(otp.getId());
        assertThat(otp.getConsumedAt()).as("a wrong guess does not burn the code").isNull();
    }

    @Test
    void aCodeThatHasRunOutOfAttemptsIsBurnedAndRefused() {
        OtpCode otp = existing("123456", 5);

        assertThatThrownBy(() -> service.verify(user, "123456", OtpPurpose.LOGIN))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Too many attempts");

        verify(attempts).burn(otp.getId());
        // Even the *right* code is refused once the cap is reached — otherwise the limit would only
        // slow an attacker down rather than stop them.
        verify(attempts, never()).recordFailedAttempt(any());
    }

    /* ---------- the happy path ---------- */

    @Test
    void theRightCodeIsAcceptedAndConsumed() {
        OtpCode otp = existing("123456", 0);

        OtpCode consumed = service.verify(user, "123456", OtpPurpose.LOGIN);

        assertThat(consumed.getConsumedAt()).isNotNull();
        verify(attempts, never()).recordFailedAttempt(any());
        assertThat(otp.getConsumedAt()).as("single use — the row is spent").isNotNull();
    }

    @Test
    void anExpiredCodeIsRefusedWithoutCountingAnAttempt() {
        OtpCode otp = existing("123456", 0);
        otp.setExpiresAt(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.verify(user, "123456", OtpPurpose.LOGIN))
                .isInstanceOf(BadRequestException.class);

        // Nothing to count: an expired code cannot be guessed into working, so an attempt against
        // it says nothing about anybody's intent.
        verify(attempts, never()).recordFailedAttempt(any());
    }

    @Test
    void aMissingCodeReadsTheSameAsAWrongOne() {
        when(codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByIdDesc(USER_ID, OtpPurpose.LOGIN))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.verify(user, "123456", OtpPurpose.LOGIN))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid or expired code");
    }

    /* ---------- issuing ---------- */

    @Test
    void aSignInCodeGoesToTheUsersOwnAddressAndCarriesNoTarget() {
        service.issue(user, OtpPurpose.LOGIN);

        ArgumentCaptor<OtpCode> saved = ArgumentCaptor.forClass(OtpCode.class);
        verify(codes).save(saved.capture());
        assertThat(saved.getValue().getTargetEmail())
                .as("the destination is implied by the user, so recording it would be a second copy")
                .isNull();

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(email).send(sent.capture());
        assertThat(sent.getValue().to()).isEqualTo("agent@firm.nz");
        assertThat(sent.getValue().subject()).contains("sign-in code");
    }

    /**
     * The property the whole email-change flow rests on: the code goes to the address being
     * claimed, and the row remembers which address that was.
     */
    @Test
    void anEmailChangeCodeGoesToTheNewAddressAndIsBoundToIt() {
        service.issueTo(user, OtpPurpose.EMAIL_CHANGE, "new@elsewhere.nz");

        ArgumentCaptor<OtpCode> saved = ArgumentCaptor.forClass(OtpCode.class);
        verify(codes).save(saved.capture());
        assertThat(saved.getValue().getTargetEmail()).isEqualTo("new@elsewhere.nz");
        assertThat(saved.getValue().getPurpose()).isEqualTo(OtpPurpose.EMAIL_CHANGE);

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(email).send(sent.capture());
        assertThat(sent.getValue().to())
                .as("to the address being claimed, not the one already on the account")
                .isEqualTo("new@elsewhere.nz");
        // Different wording, because it lands in an inbox that has never heard of us.
        assertThat(sent.getValue().subject()).contains("Confirm your new");
    }

    /** Issuing one purpose must not invalidate another's outstanding code. */
    @Test
    void issuingIsScopedToItsOwnPurpose() {
        service.issueTo(user, OtpPurpose.EMAIL_CHANGE, "new@elsewhere.nz");

        verify(codes).consumeOutstanding(org.mockito.ArgumentMatchers.eq(USER_ID),
                org.mockito.ArgumentMatchers.eq(OtpPurpose.EMAIL_CHANGE), any());
        assertThatCode(() -> verify(codes, never())
                .consumeOutstanding(any(), org.mockito.ArgumentMatchers.eq(OtpPurpose.LOGIN), any()))
                .doesNotThrowAnyException();
    }
}
