package nz.amldock.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * Presign request for a piece of course material. Any content type is accepted — only the size
 * cap applies.
 */
public record TrainingCourseFileUploadUrlRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes) {
}
