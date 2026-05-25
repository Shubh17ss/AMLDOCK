package nz.amldock.firm.dto;

public record UpdateFirmRequest(
        String name,
        String tradingName,
        String nzbn,
        String headOfficeAddress,
        String contactEmail,
        String contactPhone,
        Boolean active
) {}
