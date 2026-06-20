package nz.amldock.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import nz.amldock.user.Role;

/**
 * Users are passwordless — they sign in with email + OTP, so no password is set at creation.
 * (ROOT is seeded separately with a password and is not created through this endpoint.)
 */
public record CreateUserRequest(
        @NotBlank @Email String email,
        @NotBlank String fullName,
        @NotNull Role role,
        /** Required for firm- and branch-level roles. */
        Long realEstateFirmId,
        /** Required for branch-level roles; must be null for firm-level roles. */
        Long firmBranchId
) {}
