package nz.amldock.auth.otp;

public enum OtpPurpose {
    /** Passwordless email + OTP login for all non-ROOT roles. */
    LOGIN,
    /** Second factor after a successful ROOT password check on the admin route. */
    ADMIN_LOGIN
}
