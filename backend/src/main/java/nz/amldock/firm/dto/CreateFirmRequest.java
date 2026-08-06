package nz.amldock.firm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Onboard a real-estate firm. The compliance-officer email is used to provision an
 * AML_COMPLIANCE_OFFICER login for the firm, and numberOfBranches pre-creates that many
 * placeholder branches.
 *
 * {@code country} is an ISO 3166-1 alpha-2 code; FirmService restricts it to the jurisdictions
 * the platform operates in.
 */
public record CreateFirmRequest(
        @NotBlank String name,
        String nzbn,
        @NotBlank String country,
        String liaisonName,
        @NotBlank @Email String liaisonEmail,
        String liaisonContactNumber,
        String complianceOfficerName,
        @NotBlank @Email String complianceOfficerEmail,
        String complianceOfficerContactNumber,
        @Min(0) Integer numberOfBranches
) {}
