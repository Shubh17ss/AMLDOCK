package nz.amldock.user.dto;

import nz.amldock.user.Role;
import nz.amldock.user.UserService;

import java.time.Instant;

/**
 * A user as a member of one reporting entity. Role, firm, branch and {@code active} are that
 * membership's, so an officer serving two entities reads differently in each — see
 * {@link UserService.Member}.
 *
 * <p>{@code existingAccount} is set only on a create response: true when the address already had
 * an account and was added to this entity rather than created, so the UI can say so.
 */
public record UserDto(
        Long id,
        String email,
        String fullName,
        Role role,
        Long realEstateFirmId,
        Long firmBranchId,
        boolean active,
        Instant createdAt,
        boolean existingAccount
) {
    public static UserDto from(UserService.Member m) {
        return from(m, false);
    }

    public static UserDto from(UserService.Member m, boolean existingAccount) {
        return new UserDto(m.user().getId(), m.user().getEmail(), m.user().getFullName(), m.role(),
                m.firmId(), m.branchId(), m.active(), m.user().getCreatedAt(), existingAccount);
    }
}
