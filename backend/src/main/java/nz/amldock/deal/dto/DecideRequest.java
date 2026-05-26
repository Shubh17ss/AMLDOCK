package nz.amldock.deal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DecideRequest(
        @NotBlank @Size(min = 3, max = 4000) String notes
) {}
