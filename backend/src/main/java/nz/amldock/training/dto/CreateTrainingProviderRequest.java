package nz.amldock.training.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** A new training provider. Email is optional. */
public record CreateTrainingProviderRequest(
        @NotBlank String name,
        @Email String email,
        Long realEstateFirmId,
        Long firmBranchId) {
}
