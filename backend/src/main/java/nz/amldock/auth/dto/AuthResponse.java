package nz.amldock.auth.dto;

import nz.amldock.user.Role;

import java.util.List;

/**
 * The signed-in account, as the session sees it. Role, firm and branch are those of the membership
 * the session is in ({@code activeMembershipId}; null for ROOT and AUDIT, who have none), so
 * everything the client derives from them follows an entity switch. {@code memberships} lists every
 * entity the account is active in — more than one only for compliance officers and senior managers.
 */
public record AuthResponse(
        Long userId,
        String email,
        String fullName,
        Role role,
        Long realEstateFirmId,
        /** The firm's public id: what URLs and the /firms endpoints name it by. */
        String realEstateFirmPublicId,
        Long firmBranchId,
        Long activeMembershipId,
        List<MembershipSummary> memberships
) {}
