package nz.amldock.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Step 2 of email/admin OTP login: email plus the one-time code. */
public record OtpVerifyRequest(
        @NotBlank @Email String email,
        @NotBlank String code
) {}
