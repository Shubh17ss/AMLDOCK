package nz.amldock.firm.dto;

import nz.amldock.firm.FirmBranch;

import java.time.Instant;

public record BranchDto(
        Long id,
        /** What URLs and the /branches endpoints name the branch by. */
        String publicId,
        Long realEstateFirmId,
        String name,
        String addressLine1,
        String addressLine2,
        String suburb,
        String city,
        String postcode,
        String phone,
        String email,
        String managerName,
        String managerEmail,
        boolean active,
        /** When it was deactivated, starting its retention hold; null while active. */
        Instant deactivatedAt
) {
    public static BranchDto from(FirmBranch b) {
        return new BranchDto(b.getId(), b.getPublicId(), b.getRealEstateFirmId(), b.getName(), b.getAddressLine1(),
                b.getAddressLine2(), b.getSuburb(), b.getCity(), b.getPostcode(), b.getPhone(),
                b.getEmail(), b.getManagerName(), b.getManagerEmail(), b.isActive(), b.getDeactivatedAt());
    }
}
