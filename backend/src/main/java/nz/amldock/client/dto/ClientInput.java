package nz.amldock.client.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import nz.amldock.client.ClientType;

public record ClientInput(
        @NotBlank String displayName,
        @NotNull ClientType clientType,
        @Email String email,
        String phone
) {}
