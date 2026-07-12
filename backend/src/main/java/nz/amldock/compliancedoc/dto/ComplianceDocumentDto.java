package nz.amldock.compliancedoc.dto;

import nz.amldock.compliancedoc.ComplianceDocCategory;
import nz.amldock.compliancedoc.ComplianceDocument;

import java.time.Instant;

public record ComplianceDocumentDto(
        Long id,
        ComplianceDocCategory category,
        String name,
        String changeNotes,
        int versionNo,
        String originalFilename,
        String contentType,
        long sizeBytes,
        Long realEstateFirmId,
        Long firmBranchId,
        String branchName,
        String uploadedByEmail,
        Instant createdAt
) {
    public static ComplianceDocumentDto from(ComplianceDocument d, String branchName, String uploadedByEmail) {
        return new ComplianceDocumentDto(
                d.getId(), d.getCategory(), d.getName(), d.getChangeNotes(), d.getVersionNo(),
                d.getOriginalFilename(), d.getContentType(), d.getSizeBytes(),
                d.getRealEstateFirmId(), d.getFirmBranchId(), branchName,
                uploadedByEmail, d.getCreatedAt());
    }
}
