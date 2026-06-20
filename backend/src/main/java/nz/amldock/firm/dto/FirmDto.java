package nz.amldock.firm.dto;

import nz.amldock.firm.RealEstateFirm;

public record FirmDto(
        Long id,
        String name,
        String nzbn,
        String liaisonName,
        String liaisonEmail,
        String liaisonContactNumber,
        String seniorManagerName,
        String seniorManagerEmail,
        String seniorManagerContactNumber,
        Integer numberOfBranches,
        boolean active
) {
    public static FirmDto from(RealEstateFirm f) {
        return new FirmDto(f.getId(), f.getName(), f.getNzbn(),
                f.getLiaisonName(), f.getLiaisonEmail(), f.getLiaisonContactNumber(),
                f.getSeniorManagerName(), f.getSeniorManagerEmail(), f.getSeniorManagerContactNumber(),
                f.getNumberOfBranches(), f.isActive());
    }
}
