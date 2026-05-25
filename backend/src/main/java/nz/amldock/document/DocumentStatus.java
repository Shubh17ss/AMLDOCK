package nz.amldock.document;

public enum DocumentStatus {
    /** Backend has issued a presigned upload URL; no confirmation yet. */
    PENDING,
    /** Object exists in S3 and the document is visible in the UI. */
    ACTIVE,
    /** Soft-deleted. Row retained for audit; S3 object removed. */
    DELETED
}
