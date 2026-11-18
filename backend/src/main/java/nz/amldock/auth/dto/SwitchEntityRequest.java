package nz.amldock.auth.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Moves the caller's session into another reporting entity they belong to. {@code refreshToken} is
 * the mobile app's, which it holds in the body; the web sends none and its cookie is used instead.
 */
public record SwitchEntityRequest(
        @NotNull Long membershipId,
        @Size(max = 128) String refreshToken
) {}
