package nz.amldock.deal.assurance.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import nz.amldock.deal.assurance.AssuranceStatus;

import java.util.List;

/**
 * The whole result of an assurance, as the dialog submits it: the verdict and, for
 * ACTION_REQUIRED, every issue with its remediation. The list replaces whatever was there.
 */
public record UpdateAssuranceRequest(
        @NotNull AssuranceStatus status,
        @Valid List<Issue> issues
) {
    /** The 3-character floor matches V51's CHECK constraints. */
    public record Issue(
            @NotBlank @Size(min = 3, max = 4000) String issue,
            @NotBlank @Size(min = 3, max = 4000) String remediation
    ) {}
}
