package nz.amldock.firm.dto;

import nz.amldock.firm.RealEstateFirm;

public record FirmDto(
        Long id,
        String name,
        String tradingName,
        String nzbn,
        String headOfficeAddress,
        String contactEmail,
        String contactPhone,
        boolean active
) {
    public static FirmDto from(RealEstateFirm f) {
        return new FirmDto(f.getId(), f.getName(), f.getTradingName(), f.getNzbn(),
                f.getHeadOfficeAddress(), f.getContactEmail(), f.getContactPhone(), f.isActive());
    }
}
