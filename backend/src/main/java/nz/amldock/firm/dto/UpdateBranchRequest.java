package nz.amldock.firm.dto;

public record UpdateBranchRequest(
        String name,
        String addressLine1,
        String addressLine2,
        String suburb,
        String city,
        String postcode,
        String phone,
        String email,
        String managerName,
        String managerEmail,
        Boolean active
) {}
