package nz.amldock.document.dto;

public record UploadUrlResponse(
        Long documentId,
        String s3Key,
        String uploadUrl,
        String requiredContentType,
        int ttlSeconds
) {}
