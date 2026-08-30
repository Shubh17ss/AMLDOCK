package nz.amldock.ownership.dto;

import jakarta.validation.constraints.Size;

/**
 * Changes to the shared person record behind an INDIVIDUAL node.
 *
 * <p>All fields optional; only non-null values are applied, matching {@link UpdateNodeRequest}.
 * An empty string is a value — it clears the field — while null means "leave it alone".
 *
 * <p>Writing any of these touches every deal this person is on, so
 * {@code BeneficialOwnerService.updateDetails} runs its own firm check rather than inheriting
 * authorisation from the deal-scoped URL this arrives on.
 */
public record PersonPatch(
        String fullName,
        @Size(max = 320) String email,
        @Size(max = 2) String phoneCountry,
        @Size(max = 32) String phoneNumber,
        @Size(max = 255) String occupation,
        String sourceOfFunds,
        @Size(max = 2) String countryOfResidence
) {}
