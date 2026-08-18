package nz.amldock.client.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import nz.amldock.client.ClientType;

/**
 * The client attached to a deal.
 *
 * <p>Both fields are nullable by design. The broker's deal form scans IDs of natural persons
 * and captures a key contact, but the entity that actually owns the property (company / LLP /
 * trust / individual) is established by admin/AMLCo during the ownership-structure review that
 * follows. Until then {@code displayName} is seeded from the key contact and
 * {@code clientType} stays null, which the UI renders as "Pending review".
 */
public record ClientInput(
        @Size(max = 255) String displayName,
        ClientType clientType,
        @Email String email,
        @Size(max = 64) String phone
) {}
