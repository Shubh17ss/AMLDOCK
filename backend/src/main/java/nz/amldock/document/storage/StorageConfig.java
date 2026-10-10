package nz.amldock.document.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class StorageConfig {

    // Bind the canonical amldock.* properties (application.yml), which themselves resolve
    // from AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars with a fallback.
    // Reading the bare env-var names here meant the yml credentials were never picked up,
    // so local runs fell through to the default provider chain and failed to load any creds.
    @Value("${amldock.s3.region:ap-southeast-2}")
    private String region;

    @Value("${amldock.aws.access-key-id:}")
    private String accessKeyId;

    @Value("${amldock.aws.secret-access-key:}")
    private String secretAccessKey;

    @Bean
    public AwsCredentialsProvider awsCredentialsProvider() {
        if (!accessKeyId.isBlank() && !secretAccessKey.isBlank()) {
            return StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        }
        return DefaultCredentialsProvider.create();
    }

    // Optional S3-compatible endpoint (S3Mock in perf/docker-compose.perf.yml). Blank means real
    // AWS. Such stores address buckets by path rather than by subdomain, hence path-style.
    @Value("${amldock.s3.endpoint:}")
    private String endpoint;

    @Bean
    public S3Client s3Client(AwsCredentialsProvider credentials) {
        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials);
        if (!endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint)).forcePathStyle(true);
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner(AwsCredentialsProvider credentials) {
        var builder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials);
        if (!endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint))
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }
        return builder.build();
    }
}
