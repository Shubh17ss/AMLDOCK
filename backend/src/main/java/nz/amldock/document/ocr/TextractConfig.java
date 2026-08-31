package nz.amldock.document.ocr;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.textract.TextractClient;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * Textract wiring.
 *
 * <p>Deliberately reuses the {@code AwsCredentialsProvider} bean from
 * {@link nz.amldock.document.storage.StorageConfig} and the same {@code amldock.s3.region}
 * property rather than reading credentials again. Sharing the region property is what keeps the
 * extractors' same-region assumption true by construction: Textract's S3 integration requires the
 * bucket to live in the endpoint's region, and a drift between the two would surface as a runtime
 * InvalidS3ObjectException on real documents rather than as a startup failure.
 *
 * <p>{@code @EnableScheduling} used to live here, back when the OCR poller was the only scheduled
 * work in the application. It now sits on {@link nz.amldock.common.config.SchedulingConfig}, so
 * that deal notifications — the second polled queue — do not depend on this class and its Textract
 * client being constructed. The poller's own on/off switch is still local: see the
 * {@code @ConditionalOnProperty} on {@link ScheduledIdExtractionDispatcher}.
 */
@Configuration
public class TextractConfig {

    @Bean
    public TextractClient textractClient(AwsCredentialsProvider credentials,
                                         @Value("${amldock.s3.region:ap-southeast-2}") String region) {
        return TextractClient.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .build();
    }

    /**
     * The extraction pool. Small on purpose: Textract enforces its own per-account transaction
     * rate, so more threads buy throttling rather than throughput.
     *
     * <p>Separate from Tomcat's request threads, which is the point — extraction can saturate this
     * pool without an upload or a dashboard query waiting behind it.
     */
    @Bean("ocrExecutor")
    public ThreadPoolTaskExecutor ocrExecutor(
            @Value("${amldock.ocr.core-threads:2}") int coreThreads,
            @Value("${amldock.ocr.max-threads:4}") int maxThreads,
            @Value("${amldock.ocr.queue-capacity:32}") int queueCapacity) {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(coreThreads);
        ex.setMaxPoolSize(maxThreads);
        ex.setQueueCapacity(queueCapacity);
        ex.setThreadNamePrefix("ocr-");
        // The dispatcher waits on each batch, so the queue should never fill. If it somehow does,
        // running the task on the caller throttles the dispatcher instead of dropping the work.
        ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        ex.setWaitForTasksToCompleteOnShutdown(true);
        // On shutdown, let an in-flight Textract call finish so its row does not sit IN_PROGRESS
        // until the lease expires.
        ex.setAwaitTerminationSeconds(30);
        return ex;
    }
}
