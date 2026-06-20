package nz.amldock.firm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;

public record UpdateFirmRequest(
        String name,
        String nzbn,
        String liaisonName,
        @Email String liaisonEmail,
        String liaisonContactNumber,
        String seniorManagerName,
        @Email String seniorManagerEmail,
        String seniorManagerContactNumber,
        @Min(0) Integer numberOfBranches,
        Boolean active
) {}
