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

    /** Delete the object. No-op if it doesn't exist. */
    void delete(String key);
}
