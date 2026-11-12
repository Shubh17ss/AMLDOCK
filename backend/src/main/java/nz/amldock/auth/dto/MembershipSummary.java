package nz.amldock.auth.dto;

import nz.amldock.user.Role;

/**
 * One reporting entity the signed-in account is active in, as the entity picker shows it. The
 * client switches to it with {@code POST /api/auth/switch-entity}.
 */
public record MembershipSummary(
        Long id,
        Long realEstateFirmId,
        String realEstateFirmPublicId,
        String realEstateFirmName,
        String country,
        Long firmBranchId,
        String firmBranchName,
        Role role
) {}
