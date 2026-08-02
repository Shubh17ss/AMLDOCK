package nz.amldock.training.dto;

import nz.amldock.training.TrainingCourseFile;

import java.time.Instant;

public record TrainingCourseFileDto(
        Long id,
        String originalFilename,
        String contentType,
        Long sizeBytes,
        String uploadedByEmail,
        Instant createdAt
) {
    public static TrainingCourseFileDto from(TrainingCourseFile f, String uploadedByEmail) {
        return new TrainingCourseFileDto(f.getId(), f.getOriginalFilename(), f.getContentType(),
                f.getSizeBytes(), uploadedByEmail, f.getCreatedAt());
    }
}
