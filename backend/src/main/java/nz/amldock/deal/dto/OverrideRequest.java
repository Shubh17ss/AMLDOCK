package nz.amldock.deal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import nz.amldock.deal.DealStatus;

public record OverrideRequest(
        @NotNull DealStatus targetStatus,
        @NotBlank @Size(min = 3, max = 4000) String reason
) {}
