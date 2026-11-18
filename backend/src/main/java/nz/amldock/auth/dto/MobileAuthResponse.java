package nz.amldock.auth.dto;

/**
 * Sign-in result for the native mobile app. A phone has no browser cookie jar, so the tokens come
 * back in the body and the app keeps them in the device keychain. The web routes never return
 * this; they keep tokens in httpOnly cookies where page script can't read them.
 *
 * @param expiresIn access-token lifetime in seconds
 */
public record MobileAuthResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        AuthResponse user
) {}
