package nz.amldock.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import nz.amldock.user.Role;

public record CreateUserRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotBlank String fullName,
        @NotNull Role role,
        /** Required for BROKER and FIRM_USER; must be null for COMPLIANCE / MANAGER. */
        Long realEstateFirmId,
        /** Required for BROKER (must belong to realEstateFirmId); must be null for other roles. */
        Long firmBranchId
) {}
