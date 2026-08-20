package nz.amldock.document.ocr;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Polls the document queue and runs extraction on a pool of its own.
 *
 * <p>Nothing here touches a Tomcat request thread: {@code @Scheduled} supplies its own scheduler
 * thread, and the work runs on a small dedicated executor. Uploads stay as fast as they were.
 *
 * <p>Orchestration lives here rather than in {@link IdExtractionService} because the three phases
 * are separate transactions, and calling one {@code @Transactional} method from another on the
 * same bean would bypass Spring's proxy and quietly run the whole thing outside a transaction.
 */
@Component
@ConditionalOnProperty(name = "amldock.ocr.enabled", havingValue = "true", matchIfMissing = true)
public class ScheduledIdExtractionDispatcher implements IdExtractionDispatcher {

    private static final Logger log = LoggerFactory.getLogger(ScheduledIdExtractionDispatcher.class);

    private final IdExtractionService extraction;
    private final ThreadPoolTaskExecutor executor;
    private final int batchSize;

    public ScheduledIdExtractionDispatcher(IdExtractionService extraction,
                                           @Qualifier("ocrExecutor") ThreadPoolTaskExecutor executor,
                                           @Value("${amldock.ocr.batch-size:4}") int batchSize) {
        this.extraction = extraction;
        this.executor = executor;
        this.batchSize = batchSize;
    }

    /**
     * {@code fixedDelay}, not {@code fixedRate}: the next poll is measured from the end of the
     * last, so a slow batch can never stack ticks on top of each other.
     *
     * <p>The initial delay lets the context finish starting before the first query.
     */
    @Override
    @Scheduled(fixedDelayString = "${amldock.ocr.poll-ms:5000}",
               initialDelayString = "${amldock.ocr.initial-delay-ms:15000}")
    public void pump() {
        List<Long> ids;
        try {
            ids = extraction.claim(batchSize);
        } catch (Exception e) {
            // Never let a bad poll kill the schedule — Spring cancels a task that throws.
            log.error("Could not claim documents for extraction", e);
            return;
        }
        if (ids.isEmpty()) return;

        log.debug("Extracting {} document(s)", ids.size());

        // Waiting for the batch is deliberate. It is what stops the next tick claiming more work
        // than the pool can run, so the queue applies its own backpressure without a bounded
        // queue policy to tune.
        CompletableFuture.allOf(ids.stream()
                        .map(id -> CompletableFuture.runAsync(() -> runOne(id), executor))
                        .toArray(CompletableFuture[]::new))
                .join();
    }

    private void runOne(Long documentId) {
        try {
            var target = extraction.snapshot(documentId).orElse(null);
            if (target == null) {
                log.warn("Document {} vanished between claim and extraction", documentId);
                return;
            }
            extraction.complete(documentId, extraction.runExtraction(target));
        } catch (Exception e) {
            try {
                extraction.fail(documentId, e);
            } catch (Exception recordingFailure) {
                // The extraction failure is the interesting one; losing the record of it would
                // leave the row stuck IN_PROGRESS until the lease expires and it is retried.
                log.error("Could not record extraction failure for document {}", documentId,
                        recordingFailure);
            }
        }
    }
}
