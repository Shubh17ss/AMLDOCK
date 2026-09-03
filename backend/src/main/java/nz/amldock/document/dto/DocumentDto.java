package nz.amldock.document.dto;

import nz.amldock.document.DocumentFields;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;
import nz.amldock.document.OcrStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record DocumentDto(
        Long id,
        String originalFilename,
        String contentType,
        long sizeBytes,
        DocumentType documentType,
        DocumentStatus status,
        Long dealId,
        Long ownershipNodeId,
        Long beneficialOwnerId,
        IdSide idSide,
        Long uploadedByUserId,
        String uploadedByEmail,
        OcrStatus ocrStatus,
        String ocrProvider,
        String ocrFields,
        BigDecimal ocrConfidence,
        Instant ocrCompletedAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static DocumentDto from(DocumentFields d, String uploaderEmail) {
        return new DocumentDto(d.getDocumentId(), d.getOriginalFilename(), d.getContentType(), d.getSizeBytes(),
                d.getDocumentType(), d.getStatus(), d.getDealId(), d.getOwnershipNodeId(),
                d.getBeneficialOwnerId(), d.getIdSide(),
                d.getUploadedByUserId(), uploaderEmail,
                d.getOcrStatus(), d.getOcrProvider(), d.getOcrFields(), d.getOcrConfidence(),
                d.getOcrCompletedAt(), d.getCreatedAt(), d.getUpdatedAt());
    }
}
