package nz.amldock.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;

/**
 * What the client sends to start an upload: {@link UploadUrlRequest} with the deal named by its
 * public id. The controller resolves it and hands the service the internal request.
 */
public record PresignUploadBody(
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes,
        @NotNull DocumentType documentType,
        @NotBlank String dealId,
        Long ownershipNodeId,
        Long beneficialOwnerId,
        IdSide idSide
) {
    public UploadUrlRequest toRequest(Long internalDealId) {
        return new UploadUrlRequest(filename, contentType, sizeBytes, documentType, internalDealId,
                ownershipNodeId, beneficialOwnerId, idSide);
    }
}
