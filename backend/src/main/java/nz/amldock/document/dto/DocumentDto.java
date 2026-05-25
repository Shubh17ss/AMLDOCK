package nz.amldock.document.dto;

import nz.amldock.document.Document;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.DocumentType;
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
    public static DocumentDto from(Document d, String uploaderEmail) {
        return new DocumentDto(d.getId(), d.getOriginalFilename(), d.getContentType(), d.getSizeBytes(),
                d.getDocumentType(), d.getStatus(), d.getDealId(),
                d.getUploadedByUserId(), uploaderEmail,
                d.getOcrStatus(), d.getOcrProvider(), d.getOcrFields(), d.getOcrConfidence(),
                d.getOcrCompletedAt(), d.getCreatedAt(), d.getUpdatedAt());
    }
}
