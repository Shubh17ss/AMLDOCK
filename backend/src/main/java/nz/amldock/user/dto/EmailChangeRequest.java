package nz.amldock.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The address a user wants to move to. A code goes to it; nothing changes until that code is spent. */
public record EmailChangeRequest(
        @NotBlank(message = "An email address is required")
        @Email(message = "That doesn't look like an email address")
        @Size(max = 255, message = "Email must be 255 characters or fewer")
        String newEmail
) {}
