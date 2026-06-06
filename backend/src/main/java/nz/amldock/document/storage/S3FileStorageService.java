package nz.amldock.document.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;

@Service
public class S3FileStorageService implements FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(S3FileStorageService.class);

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

    public S3FileStorageService(S3Client client,
                                S3Presigner presigner,
                                @Value("${S3_BUCKET:amldock-deals-documents}") String bucket) {
        this.client = client;
        this.presigner = presigner;
        this.bucket = bucket;
    }

    @Override
    public String presignUpload(String key, String contentType, Duration ttl) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();
        PutObjectPresignRequest req = PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(put)
                .build();
        return presigner.presignPutObject(req).url().toString();
    }

    @Override
    public String presignDownload(String key, String originalFilename, Duration ttl) {
        String disposition = originalFilename == null ? null
                : "attachment; filename=\"" + sanitizeForHeader(originalFilename) + "\"";
        GetObjectRequest.Builder get = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key);
        if (disposition != null) get.responseContentDisposition(disposition);
        GetObjectPresignRequest req = GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(get.build())
                .build();
        return presigner.presignGetObject(req).url().toString();
    }

    @Override
    public boolean exists(String key) {
        try {
            client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return false;
            throw e;
        }
    }

    @Override
    public long size(String key) {
        HeadObjectResponse head = client.headObject(HeadObjectRequest.builder()
                .bucket(bucket).key(key).build());
        return head.contentLength();
    }

    @Override
    public void delete(String key) {
        try {
            client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (S3Exception e) {
            log.warn("S3 delete failed for key={} status={}: {}", key, e.statusCode(), e.getMessage());
        }
    }

    private static String sanitizeForHeader(String filename) {
        return filename.replaceAll("[\\r\\n\"]", "_");
    }
}
