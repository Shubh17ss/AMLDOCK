package nz.amldock.suspiciousactivity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/** Presign request for a register entry's supporting PDF. */
public record SuspiciousActivityUploadUrlRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes) {
}
