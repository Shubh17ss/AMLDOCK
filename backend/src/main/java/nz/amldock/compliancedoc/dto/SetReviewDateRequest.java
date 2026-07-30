package nz.amldock.compliancedoc.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

/** Set (or clear, when nextReviewDate is null) the next review date for a scoped module. */
public record SetReviewDateRequest(
        @NotBlank String moduleKey,
        LocalDate nextReviewDate,
        // Target scope. Non-ROOT callers are pinned to their own firm regardless.
        Long realEstateFirmId,
        Long firmBranchId
) {}
