package nz.amldock.auth.dto;

import jakarta.validation.constraints.Size;

/** Optional refresh token to revoke on mobile sign-out; without one, all the caller's sessions end. */
public record MobileLogoutRequest(
        @Size(max = 128) String refreshToken
) {}
