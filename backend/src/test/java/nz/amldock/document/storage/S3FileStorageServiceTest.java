package nz.amldock.document.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URL;
import java.time.Duration;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * F7: a presigned upload URL never writes the key a record points at. Confirm copies the staged
 * bytes across, so the URL, still valid for minutes, can't change what was confirmed.
 */
@ExtendWith(MockitoExtension.class)
class S3FileStorageServiceTest {

    static final String KEY = "deals/1/abc-passport.jpg";
    static final String INCOMING = "incoming/deals/1/abc-passport.jpg";

    @Mock S3Client client;
    @Mock S3Presigner presigner;

    S3FileStorageService storage;

    @BeforeEach
    void setUp() {
        storage = new S3FileStorageService(client, presigner, "bucket");
    }

    private void headReturns(String key, long size) {
        when(client.headObject(argThat((HeadObjectRequest r) -> r != null && key.equals(r.key()))))
                .thenReturn(HeadObjectResponse.builder().contentLength(size).build());
    }

    private void headMissing(String key) {
        when(client.headObject(argThat((HeadObjectRequest r) -> r != null && key.equals(r.key()))))
                .thenThrow(NoSuchKeyException.builder().build());
    }

    @Test
    void theUploadUrlIsSignedForTheStagingKey() throws Exception {
        PresignedPutObjectRequest signed = mock(PresignedPutObjectRequest.class);
        when(signed.url()).thenReturn(new URL("https://s3.example/put"));
        ArgumentCaptor<PutObjectPresignRequest> captor = ArgumentCaptor.forClass(PutObjectPresignRequest.class);
        when(presigner.presignPutObject(captor.capture())).thenReturn(signed);

        storage.presignIncomingUpload(KEY, "image/jpeg", Duration.ofMinutes(5));

        assertThat(captor.getValue().putObjectRequest().key()).isEqualTo(INCOMING);
    }

    @Test
    void promoteCopiesTheStagedBytesAcrossAndDropsTheStagingObject() {
        headReturns(KEY, 1234L);

        OptionalLong size = storage.promoteUpload(KEY);

        assertThat(size).hasValue(1234L);
        verify(client).copyObject(argThat((CopyObjectRequest r) ->
                INCOMING.equals(r.sourceKey()) && KEY.equals(r.destinationKey())));
        verify(client).deleteObject(argThat((DeleteObjectRequest r) -> INCOMING.equals(r.key())));
    }

    @Test
    void anUploadPresignedBeforeStagingIsStillAccepted() {
        when(client.copyObject(any(CopyObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());
        headReturns(KEY, 99L);

        assertThat(storage.promoteUpload(KEY)).hasValue(99L);
        verify(client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void nothingUploadedIsEmpty() {
        when(client.copyObject(any(CopyObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());
        headMissing(KEY);

        assertThat(storage.promoteUpload(KEY)).isEmpty();
    }
}
