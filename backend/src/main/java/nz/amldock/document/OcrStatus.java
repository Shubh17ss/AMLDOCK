package nz.amldock.document;

public enum OcrStatus {
    /** Not an identity document — nothing to extract. See {@link DocumentType#isOcrEligible()}. */
    NOT_APPLICABLE,
    /** Queued. Set by confirmUpload once the bytes are provably in S3. */
    PENDING,
    /** Claimed by a worker. A claim older than the lease is treated as abandoned and re-collected. */
    IN_PROGRESS,
    DONE,
    /** Gave up — either a permanent error, or the retry ladder ran out. Reason in ocr_error. */
    FAILED
}
