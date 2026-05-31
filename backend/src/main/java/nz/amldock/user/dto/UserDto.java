package nz.amldock.user.dto;

import nz.amldock.user.Role;
import nz.amldock.user.User;

import java.time.Instant;

public record UserDto(
        Long id,
        String email,
        String fullName,
        Role role,
        Long realEstateFirmId,
        Long firmBranchId,
        boolean active,
        Instant createdAt
) {
    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(),
                u.getRealEstateFirmId(), u.getFirmBranchId(),
                u.isActive(), u.getCreatedAt());
    }
}
