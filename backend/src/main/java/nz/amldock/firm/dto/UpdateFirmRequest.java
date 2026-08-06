package nz.amldock.firm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;

/** A partial firm edit — null means "leave this alone". */
public record UpdateFirmRequest(
        String name,
        String nzbn,
        String country,
        String liaisonName,
        @Email String liaisonEmail,
        String liaisonContactNumber,
        String complianceOfficerName,
        @Email String complianceOfficerEmail,
        String complianceOfficerContactNumber,
        @Min(0) Integer numberOfBranches,
        Boolean active
) {}
