package nz.amldock.auth.dto;

import nz.amldock.user.Role;

public record AuthResponse(
        Long userId,
        String email,
        String fullName,
        Role role,
        Long realEstateFirmId,
        /** The firm's public id: what URLs and the /firms endpoints name it by. */
        String realEstateFirmPublicId,
        Long firmBranchId
) {}
