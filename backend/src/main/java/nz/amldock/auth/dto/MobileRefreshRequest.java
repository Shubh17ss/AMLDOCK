package nz.amldock.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The mobile app's refresh token, sent in the body because it has no cookie. */
public record MobileRefreshRequest(
        @NotBlank @Size(max = 128) String refreshToken
) {}
