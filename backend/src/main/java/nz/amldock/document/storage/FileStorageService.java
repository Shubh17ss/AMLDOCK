package nz.amldock.document.storage;

import java.time.Duration;
import java.util.OptionalLong;

/**
 * Storage abstraction over S3 (or any object store). All file bytes flow client-to-S3
 * via presigned URLs — the backend never streams bytes.
 *
 * <p><b>Uploads go through a staging key (security scan F7).</b> A presigned PUT stays usable
 * until it expires, confirm or no confirm. So the URL is signed for {@link #incomingKey}, never
 * for the record's own key, and {@link #promoteUpload} copies the bytes across at confirm. After
 * that the URL can only write an orphan under {@code incoming/}: what a reviewer saw, OCR read
 * and a version signed off stays exactly as it was.
 */
public interface FileStorageService {

    /** Prefix for upload staging objects. Expire it with an S3 lifecycle rule (see infra/). */
    String INCOMING_PREFIX = "incoming/";

    /** Where a presigned upload for {@code key} actually writes. */
    static String incomingKey(String key) {
        return INCOMING_PREFIX + key;
    }

    /**
     * A presigned PUT URL for the upload that will become {@code key}. It writes to
     * {@link #incomingKey(String)}, never to {@code key} itself. Includes Content-Type binding.
     */
    String presignIncomingUpload(String key, String contentType, Duration ttl);

    /**
     * Confirm step: copy the uploaded bytes from the staging key to {@code key}, drop the staging
     * object, and return the stored size. Empty if nothing was uploaded.
     *
     * <p>Also accepts an object already at {@code key} with nothing staged: an upload presigned
     * before staging keys existed. No URL to a final key is issued any more, so this can't be used
     * to slip bytes past the copy.
     */
    OptionalLong promoteUpload(String key);

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
