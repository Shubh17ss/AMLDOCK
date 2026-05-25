package nz.amldock.firm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateFirmRequest(
        @NotBlank String name,
        String tradingName,
        String nzbn,
        String headOfficeAddress,
        @Email String contactEmail,
        String contactPhone
) {}
