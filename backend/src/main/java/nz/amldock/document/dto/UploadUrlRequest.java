package nz.amldock.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;

public record UploadUrlRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes,
        @NotNull DocumentType documentType,
        @NotNull Long dealId,
        /** Optional: attach this document to a specific ownership node within the deal. */
        Long ownershipNodeId,
        /**
         * Optional: the person this scan belongs to. Null starts a new individual; passing an
         * existing owner is how the back of a card joins the front rather than creating a
         * second person.
         */
        Long beneficialOwnerId,
        /** Which face of the card. Only meaningful for identity documents. */
        IdSide idSide
) {}
