package nz.amldock.compliancedoc.dto;

import jakarta.validation.constraints.NotBlank;

/** Mark a scoped module as reviewed as of now (stamps the completion date). */
public record CompleteReviewRequest(
        @NotBlank String moduleKey,
        Long realEstateFirmId,
        Long firmBranchId
) {}
