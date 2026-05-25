package nz.amldock.firm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateBranchRequest(
        @NotBlank String name,
        String addressLine1,
        String addressLine2,
        String suburb,
        String city,
        String postcode,
        String phone,
        @Email String email,
        String managerName,
        @Email String managerEmail
) {}
