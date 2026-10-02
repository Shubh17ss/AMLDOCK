package nz.amldock.deal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import nz.amldock.deal.RiskRating;

/**
 * A reviewer manually overriding the deal's risk band.
 *
 * <p>The comment is required, and the same 3-4000 bound {@code OverrideRequest} uses for a status
 * override. A rating that disagrees with its own workings is only defensible if the record says
 * who disagreed and why — without that, the override is indistinguishable from a mistake.
 */
public record RiskOverrideRequest(
        @NotNull RiskRating rating,
        @NotBlank @Size(min = 3, max = 4000) String comment
) {}
