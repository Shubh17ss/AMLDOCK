package nz.amldock.compliancedoc.dto;

import jakarta.validation.constraints.NotNull;
import nz.amldock.compliancedoc.ComplianceDocCategory;

import java.time.LocalDate;

/** Set (or clear, when nextReviewDate is null) the next review date for a scoped register. */
public record SetReviewDateRequest(
        @NotNull ComplianceDocCategory category,
        LocalDate nextReviewDate,
        // Target scope. Non-ROOT callers are pinned to their own firm regardless.
        Long realEstateFirmId,
        Long firmBranchId
) {}
