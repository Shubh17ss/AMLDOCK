package nz.amldock.fundtransaction.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/** Presign request for a register entry's supporting PDF. The entry id comes from the path. */
public record FundTransactionUploadUrlRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        @Positive long sizeBytes) {}
