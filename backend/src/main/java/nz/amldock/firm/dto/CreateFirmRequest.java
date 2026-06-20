package nz.amldock.firm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Onboard a real-estate firm. The senior-manager email is used to provision a SENIOR_MANAGER
 * login for the firm, and numberOfBranches pre-creates that many placeholder branches.
 */
public record CreateFirmRequest(
        @NotBlank String name,
        String nzbn,
        String liaisonName,
        @NotBlank @Email String liaisonEmail,
        String liaisonContactNumber,
        String seniorManagerName,
        @NotBlank @Email String seniorManagerEmail,
        String seniorManagerContactNumber,
        @Min(0) Integer numberOfBranches
) {}
