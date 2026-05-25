package nz.amldock.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import nz.amldock.document.DocumentType;

public record UploadUrlRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes,
        @NotNull DocumentType documentType,
        @NotNull Long dealId
) {}
