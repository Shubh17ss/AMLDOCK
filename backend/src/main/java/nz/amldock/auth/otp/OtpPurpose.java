package nz.amldock.auth.otp;

/**
 * What a one-time code is for.
 *
 * <p>Codes are scoped by purpose everywhere — issuing, finding and consuming all key on
 * {@code (userId, purpose)} — so a code issued for one of these can never be spent on another, and
 * requesting one does not invalidate the others.
 *
 * <p>Stored as a string in {@code otp_code.purpose}, which carries no CHECK constraint, so this
 * enum is the only place the set is defined.
 */
public enum OtpPurpose {
    /** Passwordless email + OTP login for all non-ROOT roles. */
    LOGIN,
    /** Second factor after a successful ROOT password check on the admin route. */
    ADMIN_LOGIN,
    /**
     * Proof that a new email address reaches the person asking to move to it.
     *
     * <p>The only purpose whose code is <em>not</em> sent to the user's current address — that is
     * the whole point of it, and the reason {@link OtpCode#getTargetEmail()} exists. Since email is
     * the login credential here, a code sent to the address being claimed is what makes the claim
     * mean anything.
     */
    EMAIL_CHANGE
}
