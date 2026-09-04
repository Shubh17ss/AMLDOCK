package nz.amldock.user;

import nz.amldock.audit.AuditService;
import nz.amldock.auth.otp.OtpCode;
import nz.amldock.auth.otp.OtpPurpose;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.email.EmailChangeNotice;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Editing your own account.
 *
 * <p>The email half is the part with teeth. Sign-in is an address plus a code, so the address is
 * the credential — and the guarantees that make moving it safe are all here rather than in the
 * schema: the code goes to the address being claimed, the address is read back off the code rather
 * than off the request, and uniqueness is re-checked after the ten-minute window has elapsed.
 */
@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    static final Long USER_ID = 7L;

    @Mock UserRepository users;
    @Mock OtpService otp;
    @Mock EmailChangeNotice notice;
    @Mock AuditService audit;

    UserProfileService service;
    User me;

    @BeforeEach
    void setUp() {
        service = new UserProfileService(users, otp, notice, audit);
        me = new User();
        ReflectionTestUtils.setField(me, "id", USER_ID);
        me.setEmail("agent@firm.nz");
        me.setFullName("An Agent");
        me.setRole(Role.AGENT);
        lenient().when(users.findById(USER_ID)).thenReturn(Optional.of(me));
    }

    private OtpCode codeFor(String targetEmail) {
        OtpCode otpCode = new OtpCode();
        ReflectionTestUtils.setField(otpCode, "id", 100L);
        otpCode.setTargetEmail(targetEmail);
        return otpCode;
    }

    /* ---------- name ---------- */

    @Test
    void aNameIsTrimmedOnTheWayIn() {
        service.updateOwnName(USER_ID, "  Jane  Smith  ");
        // Trailing space is invisible everywhere it renders and wrong everywhere it sorts. The
        // manager path (UserService.update) still stores what it is handed.
        assertThat(me.getFullName()).isEqualTo("Jane  Smith");
    }

    /* ---------- requesting a change ---------- */

    @Test
    void requestingAChangeMailsTheNewAddressAndMovesNothingYet() {
        service.requestEmailChange(USER_ID, "New@Elsewhere.NZ");

        verify(otp).issueTo(eq(me), eq(OtpPurpose.EMAIL_CHANGE), eq("new@elsewhere.nz"));
        assertThat(me.getEmail())
                .as("the account does not move until the code comes back")
                .isEqualTo("agent@firm.nz");
        verify(notice, never()).notifyPreviousAddress(any(), any(), any());
    }

    @Test
    void anAddressAlreadyInUseIsRefusedBeforeAnyCodeIsSent() {
        when(users.existsByEmailIgnoreCaseAndIdNot("taken@firm.nz", USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.requestEmailChange(USER_ID, "taken@firm.nz"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("already in use");

        verify(otp, never()).issueTo(any(), any(), any());
    }

    @Test
    void askingForTheAddressYouAlreadyHaveIsRefused() {
        assertThatThrownBy(() -> service.requestEmailChange(USER_ID, "AGENT@firm.nz"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("already your email");

        verify(otp, never()).issueTo(any(), any(), any());
    }

    /* ---------- verifying ---------- */

    @Test
    void aVerifiedCodeMovesTheAccountAndTellsTheOldAddress() {
        when(otp.verify(me, "123456", OtpPurpose.EMAIL_CHANGE)).thenReturn(codeFor("new@elsewhere.nz"));

        service.verifyEmailChange(USER_ID, "123456");

        assertThat(me.getEmail()).isEqualTo("new@elsewhere.nz");
        // The only signal that reaches somebody who would notice a hijack — everything else about
        // the change goes to whoever made it.
        verify(notice).notifyPreviousAddress("agent@firm.nz", "An Agent", "new@elsewhere.nz");
    }

    /**
     * The property the flow rests on. The address comes from the code, so a request carrying a
     * different one cannot redirect the move — there is nowhere for it to be read from.
     */
    @Test
    void theNewAddressComesFromTheCodeNotTheRequest() {
        when(otp.verify(me, "123456", OtpPurpose.EMAIL_CHANGE)).thenReturn(codeFor("proven@elsewhere.nz"));

        service.verifyEmailChange(USER_ID, "123456");

        assertThat(me.getEmail()).isEqualTo("proven@elsewhere.nz");
    }

    /**
     * The ten-minute window is long enough for somebody else to claim the address. Caught here
     * rather than at the unique index, which would surface as a 500 — after the code had been
     * consumed, leaving the user with nothing to retry.
     */
    @Test
    void anAddressClaimedDuringTheWindowIsRefusedAtVerify() {
        when(otp.verify(me, "123456", OtpPurpose.EMAIL_CHANGE)).thenReturn(codeFor("contested@firm.nz"));
        when(users.existsByEmailIgnoreCaseAndIdNot("contested@firm.nz", USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.verifyEmailChange(USER_ID, "123456"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("already in use");

        assertThat(me.getEmail()).isEqualTo("agent@firm.nz");
        verify(notice, never()).notifyPreviousAddress(any(), any(), any());
    }

    @Test
    void aCodeWithNoAddressBoundToItCannotMoveAnything() {
        when(otp.verify(me, "123456", OtpPurpose.EMAIL_CHANGE)).thenReturn(codeFor(null));

        assertThatThrownBy(() -> service.verifyEmailChange(USER_ID, "123456"))
                .isInstanceOf(BadRequestException.class);

        assertThat(me.getEmail())
                .as("a null must not reach setEmail and take the login with it")
                .isEqualTo("agent@firm.nz");
    }

    @Test
    void aRejectedCodeLeavesTheAccountAlone() {
        when(otp.verify(me, "000000", OtpPurpose.EMAIL_CHANGE))
                .thenThrow(new BadRequestException("Invalid or expired code"));

        assertThatThrownBy(() -> service.verifyEmailChange(USER_ID, "000000"))
                .isInstanceOf(BadRequestException.class);

        assertThat(me.getEmail()).isEqualTo("agent@firm.nz");
        verify(notice, never()).notifyPreviousAddress(any(), any(), any());
    }
}
