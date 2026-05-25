package nz.amldock.document.dto;

import jakarta.validation.constraints.NotNull;

public record ConfirmUploadRequest(
        @NotNull Long documentId
) {}
