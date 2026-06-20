package nz.amldock.user.dto;

import jakarta.validation.constraints.Email;
import nz.amldock.user.Role;

public record UpdateUserRequest(
        String fullName,
        @Email String email,
        Role role,
        Long realEstateFirmId,
        Long firmBranchId,
        Boolean active
) {}
