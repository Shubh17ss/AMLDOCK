package nz.amldock.document.ocr;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.DocumentType;
import nz.amldock.document.OcrStatus;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.textract.model.BadDocumentException;
import software.amazon.awssdk.services.textract.model.DocumentTooLargeException;
import software.amazon.awssdk.services.textract.model.InternalServerErrorException;
import software.amazon.awssdk.services.textract.model.InvalidParameterException;
import software.amazon.awssdk.services.textract.model.InvalidS3ObjectException;
import software.amazon.awssdk.services.textract.model.ProvisionedThroughputExceededException;
import software.amazon.awssdk.services.textract.model.ThrottlingException;
import software.amazon.awssdk.services.textract.model.UnsupportedDocumentException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Extraction of identity fields from scanned IDs, off the request thread.
 *
 * <p><strong>The transaction boundaries are the design.</strong> Work happens in three phases and
 * the Textract call — one to five seconds of network — sits outside every one of them. HikariCP
 * runs a default pool of ten connections; holding one open across that call would starve the HTTP
 * threads under any real upload burst, which is the failure this class is shaped to avoid.
 *
 * <p>Orchestration lives in {@link ScheduledIdExtractionDispatcher} rather than here, because
 * calling one {@code @Transactional} method from another on the same bean bypasses the proxy and
 * silently loses the transaction.
 */
@Service
public class IdExtractionService {

    private static final Logger log = LoggerFactory.getLogger(IdExtractionService.class);

    static final int MAX_ATTEMPTS = 3;

    /**
     * How long after a failure the next attempt becomes due. Indexed by attempt number, so the
     * ladder is 1 minute then 5; a third failure is terminal.
     */
    private static final Duration[] BACKOFF = {
            Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(25),
    };

    /** ocr_error is TEXT, but a stack-trace-length message helps nobody reading a document row. */
    private static final int MAX_ERROR_LENGTH = 500;

    private final DocumentRepository documents;
    private final UserRepository users;
    private final List<IdExtractor> extractors;
    private final BeneficialOwnerService beneficialOwners;
    private final AuditService audit;
    private final ObjectMapper json;
    private final String bucket;
    private final Duration lease;

    public IdExtractionService(DocumentRepository documents,
                               UserRepository users,
                               List<IdExtractor> extractors,
                               BeneficialOwnerService beneficialOwners,
                               AuditService audit,
                               ObjectMapper json,
                               @Value("${amldock.s3.bucket:amldock-deals-documents}") String bucket,
                               @Value("${amldock.ocr.lease-minutes:10}") long leaseMinutes) {
        this.documents = documents;
        this.users = users;
        this.extractors = extractors;
        this.beneficialOwners = beneficialOwners;
        this.audit = audit;
        this.json = json;
        this.bucket = bucket;
        this.lease = Duration.ofMinutes(leaseMinutes);
    }

    /** What a worker needs to run one extraction, read once so the entity is not held open. */
    public record Target(Long documentId, String s3Key, DocumentType documentType) {}

    /* ---------- phase 1: claim ---------- */

    /**
     * Marks up to {@code batchSize} documents as ours and returns their ids. Short by
     * construction — no network, no extraction.
     */
    @Transactional
    public List<Long> claim(int batchSize) {
        Instant staleBefore = Instant.now().minus(lease);
        List<Long> ids = documents.findClaimableOcrIds(staleBefore, batchSize);
        if (ids.isEmpty()) return List.of();

        Instant now = Instant.now();
        for (Document d : documents.findAllById(ids)) {
            if (d.getOcrStatus() == OcrStatus.IN_PROGRESS) {
                log.warn("Reclaiming document {} — previous worker did not finish", d.getId());
            }
            d.setOcrStatus(OcrStatus.IN_PROGRESS);
            d.setOcrClaimedAt(now);
        }
        return ids;
    }

    @Transactional(readOnly = true)
    public Optional<Target> snapshot(Long documentId) {
        return documents.findById(documentId)
                .map(d -> new Target(d.getId(), d.getS3Key(), d.getDocumentType()));
    }

    /* ---------- phase 2: extract (no transaction, no connection held) ---------- */

    public ExtractedIdFields runExtraction(Target target) {
        IdExtractor extractor = extractors.stream()
                .filter(e -> e.supports(target.documentType()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No extractor registered for " + target.documentType()));
        return extractor.extract(bucket, target.s3Key());
    }

    /* ---------- phase 3: record the outcome ---------- */

    @Transactional
    public void complete(Long documentId, ExtractedIdFields fields) {
        Document doc = documents.findById(documentId).orElse(null);
        if (doc == null) return;

        doc.setOcrStatus(OcrStatus.DONE);
        doc.setOcrProvider("AWS_TEXTRACT");
        doc.setOcrRawText(fields.rawText());
        doc.setOcrFields(fieldsJson(fields));
        doc.setOcrConfidence(weakestConfidence(fields));
        doc.setOcrCompletedAt(Instant.now());
        doc.setOcrError(null);
        doc.setOcrNextAttemptAt(null);

        // Same transaction as the result, so a document cannot be DONE without its person.
        beneficialOwners.recordFromExtraction(doc, fields);

        recordAudit(doc, AuditAction.OCR_COMPLETED, summarise(doc, fields));
    }

    @Transactional
    public void fail(Long documentId, Exception cause) {
        Document doc = documents.findById(documentId).orElse(null);
        if (doc == null) return;

        int attempt = doc.getOcrAttemptCount() + 1;
        doc.setOcrAttemptCount(attempt);
        doc.setOcrError(truncate(cause.toString()));

        boolean retryable = isRetryable(cause);
        if (retryable && attempt < MAX_ATTEMPTS) {
            doc.setOcrStatus(OcrStatus.PENDING);
            doc.setOcrClaimedAt(null);
            doc.setOcrNextAttemptAt(Instant.now().plus(BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)]));
            // Not audited: a retry that then succeeds is noise in a compliance trail. Only the
            // terminal outcome below is recorded.
            log.warn("Extraction attempt {} failed for document {}, retrying: {}",
                    attempt, documentId, cause.toString());
            return;
        }

        doc.setOcrStatus(OcrStatus.FAILED);
        doc.setOcrClaimedAt(null);
        doc.setOcrNextAttemptAt(null);
        doc.setOcrCompletedAt(Instant.now());
        log.warn("Extraction failed permanently for document {} after {} attempt(s): {}",
                documentId, attempt, cause.toString());
        recordAudit(doc, AuditAction.OCR_FAILED,
                "Could not read " + doc.getOriginalFilename() + " after " + attempt + " attempt(s)");
    }

    /* ---------- helpers ---------- */

    /**
     * Whether another attempt could plausibly succeed.
     *
     * <p>Throttling and 5xx are transient; "we cannot read this document" is not, and retrying it
     * only burns quota on a scan that will never parse. Anything unrecognised is treated as
     * permanent, so a bug in our own code surfaces as one visible failure rather than three.
     */
    static boolean isRetryable(Exception e) {
        if (e instanceof ProvisionedThroughputExceededException
                || e instanceof ThrottlingException
                || e instanceof InternalServerErrorException
                || e instanceof SdkClientException) {
            return true;
        }
        if (e instanceof UnsupportedDocumentException
                || e instanceof BadDocumentException
                || e instanceof DocumentTooLargeException
                || e instanceof InvalidS3ObjectException
                || e instanceof InvalidParameterException) {
            return false;
        }
        return e instanceof AwsServiceException ase && ase.statusCode() >= 500;
    }

    /**
     * One number for a document that holds three independently-read fields, so it reports the
     * <em>weakest</em>. An average would let a crisp name hide an illegible date of birth, which
     * is the opposite of what someone scanning a list needs to see.
     */
    static BigDecimal weakestConfidence(ExtractedIdFields fields) {
        return java.util.stream.Stream.of(fields.fullName(), fields.dateOfBirth(), fields.expiryDate())
                .filter(ExtractedField::isPresent)
                .map(ExtractedField::confidence)
                .filter(java.util.Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);
    }

    private String fieldsJson(ExtractedIdFields fields) {
        ObjectNode root = json.createObjectNode();
        put(root, "fullName", fields.fullName());
        put(root, "dateOfBirth", fields.dateOfBirth());
        put(root, "expiryDate", fields.expiryDate());
        return root.toString();
    }

    private void put(ObjectNode root, String key, ExtractedField<?> field) {
        ObjectNode node = root.putObject(key);
        if (field.value() == null) {
            node.putNull("value");
        } else {
            node.put("value", String.valueOf(field.value()));
        }
        if (field.confidence() == null) node.putNull("confidence");
        else node.put("confidence", field.confidence());
    }

    /**
     * The worker has no SecurityContext, so {@code AuditService.record} would write a null actor.
     * The broker who uploaded the scan is the attributable party, and attributing it to them is
     * what makes the entry usable in an audit.
     */
    private void recordAudit(Document doc, AuditAction action, String summary) {
        String email = users.findById(doc.getUploadedByUserId()).map(User::getEmail).orElse(null);
        audit.recordForUser(doc.getUploadedByUserId(), email, action, "Document", doc.getId(), summary);
    }

    private static String summarise(Document doc, ExtractedIdFields fields) {
        int found = (fields.fullName().isPresent() ? 1 : 0)
                + (fields.dateOfBirth().isPresent() ? 1 : 0)
                + (fields.expiryDate().isPresent() ? 1 : 0);
        return "Extracted " + found + " of 3 fields from " + doc.getOriginalFilename();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= MAX_ERROR_LENGTH ? s : s.substring(0, MAX_ERROR_LENGTH);
    }
}
