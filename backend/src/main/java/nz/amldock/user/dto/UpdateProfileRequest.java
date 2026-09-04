package nz.amldock.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * What a user may change about themselves without anyone else's involvement.
 *
 * <p>Name only. Email is absent on purpose: it is the sign-in credential, so moving it needs proof
 * that the new address reaches the person asking — see the email-change endpoints. Role, firm and
 * branch are absent for the obvious reason.
 *
 * <p>Constrained where {@link UpdateUserRequest#fullName()} is not. That one carries no annotation
 * at all, so a name of pure whitespace is only turned away by {@code update}'s {@code isBlank}
 * check, and {@code "  Jane  "} is stored with its padding intact.
 */
public record UpdateProfileRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must be 255 characters or fewer")
        String fullName
) {}
