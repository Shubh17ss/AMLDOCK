package nz.amldock.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Step 1 of email + OTP login: just the email to send a code to. */
public record OtpRequestRequest(
        @NotBlank @Email String email
) {}
