package nz.amldock.document.dto;

import nz.amldock.document.DocumentFields;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;
import nz.amldock.document.OcrStatus;
import nz.amldock.user.User;

import java.math.BigDecimal;
import java.time.Instant;

public record DocumentDto(
        Long id,
        String originalFilename,
        String contentType,
        long sizeBytes,
        DocumentType documentType,
        DocumentStatus status,
        // The internal id — kept off the wire, where deals are named by their public id.
        @com.fasterxml.jackson.annotation.JsonIgnore Long dealId,
        Long ownershipNodeId,
        Long beneficialOwnerId,
        IdSide idSide,
        Long uploadedByUserId,
        String uploadedByEmail,
        String uploadedByName,
        OcrStatus ocrStatus,
        String ocrProvider,
        String ocrFields,
        BigDecimal ocrConfidence,
        Instant ocrCompletedAt,
        Instant createdAt,
        Instant updatedAt
) {
    /** {@code uploader} may be null — a deleted user, or a system-created document. */
    public static DocumentDto from(DocumentFields d, User uploader) {
        return new DocumentDto(d.getDocumentId(), d.getOriginalFilename(), d.getContentType(), d.getSizeBytes(),
                d.getDocumentType(), d.getStatus(), d.getDealId(), d.getOwnershipNodeId(),
                d.getBeneficialOwnerId(), d.getIdSide(),
                d.getUploadedByUserId(),
                uploader == null ? null : uploader.getEmail(),
                uploader == null ? null : uploader.getFullName(),
                d.getOcrStatus(), d.getOcrProvider(), d.getOcrFields(), d.getOcrConfidence(),
                d.getOcrCompletedAt(), d.getCreatedAt(), d.getUpdatedAt());
    }
}
