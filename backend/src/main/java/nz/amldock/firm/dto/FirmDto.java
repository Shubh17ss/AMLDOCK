package nz.amldock.firm.dto;

import nz.amldock.firm.RealEstateFirm;

public record FirmDto(
        Long id,
        String name,
        String nzbn,
        String country,
        String liaisonName,
        String liaisonEmail,
        String liaisonContactNumber,
        String complianceOfficerName,
        String complianceOfficerEmail,
        String complianceOfficerContactNumber,
        Integer numberOfBranches,
        boolean active
) {
    public static FirmDto from(RealEstateFirm f) {
        return new FirmDto(f.getId(), f.getName(), f.getNzbn(), f.getCountry(),
                f.getLiaisonName(), f.getLiaisonEmail(), f.getLiaisonContactNumber(),
                f.getComplianceOfficerName(), f.getComplianceOfficerEmail(),
                f.getComplianceOfficerContactNumber(),
                f.getNumberOfBranches(), f.isActive());
    }
}
