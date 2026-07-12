package nz.amldock.compliancedoc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import nz.amldock.compliancedoc.ComplianceDocCategory;

public record ComplianceUploadUrlRequest(
        @NotNull ComplianceDocCategory category,
        @NotBlank String name,
        String changeNotes,
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes,
        // Target register. Non-ROOT callers are pinned to their own firm regardless;
        // branch (optional) tags the revision as branch-specific instead of firm-wide.
        Long realEstateFirmId,
        Long firmBranchId
) {}
