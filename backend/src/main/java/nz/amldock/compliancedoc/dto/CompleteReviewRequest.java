package nz.amldock.compliancedoc.dto;

import jakarta.validation.constraints.NotNull;
import nz.amldock.compliancedoc.ComplianceDocCategory;

/** Mark a scoped register as reviewed as of now (stamps the completion date). */
public record CompleteReviewRequest(
        @NotNull ComplianceDocCategory category,
        Long realEstateFirmId,
        Long firmBranchId
) {}
