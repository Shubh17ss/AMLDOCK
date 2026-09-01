package nz.amldock.document.storage;

import java.time.Duration;

/**
 * Storage abstraction over S3 (or any object store). All file bytes flow client-to-S3
 * via presigned URLs — the backend never streams bytes.
 */
public interface FileStorageService {

    /** Returns a presigned PUT URL the client uploads to. Includes Content-Type binding. */
    String presignUpload(String key, String contentType, Duration ttl);

    /** Returns a presigned GET URL the client downloads from. */
    String presignDownload(String key, String originalFilename, Duration ttl);

    /** True if the object exists in S3 right now. */
    boolean exists(String key);

    /** Object size in bytes; throws if the object doesn't exist. */
    long size(String key);

    /**
     * Copies an object to a second key, leaving the source untouched.
     *
     * <p>The one operation here that moves bytes, and it still does not move them through this
     * process — the store copies server-side. Used when a document follows a person from one deal
     * onto another: each deal gets its own object, so deleting either one cannot reach the other.
     * Sharing a key instead would be silently destructive, because {@code delete} takes no account
     * of whether anything else still points at it.
     */
    void copy(String sourceKey, String destinationKey);

    /** Delete the object. No-op if it doesn't exist. */
    void delete(String key);
}
