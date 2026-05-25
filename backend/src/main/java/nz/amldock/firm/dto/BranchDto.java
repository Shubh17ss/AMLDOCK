package nz.amldock.firm.dto;

import nz.amldock.firm.FirmBranch;

public record BranchDto(
        Long id,
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
        boolean active
) {
    public static BranchDto from(FirmBranch b) {
        return new BranchDto(b.getId(), b.getRealEstateFirmId(), b.getName(), b.getAddressLine1(),
                b.getAddressLine2(), b.getSuburb(), b.getCity(), b.getPostcode(), b.getPhone(),
                b.getEmail(), b.getManagerName(), b.getManagerEmail(), b.isActive());
    }
}
