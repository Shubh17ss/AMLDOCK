package nz.amldock.user.dto;

import nz.amldock.user.Role;

public record UpdateUserRequest(
        String fullName,
        Role role,
        Long realEstateFirmId,
        Boolean active
) {}
