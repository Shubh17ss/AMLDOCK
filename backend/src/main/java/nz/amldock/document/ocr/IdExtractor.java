package nz.amldock.document.ocr;

import nz.amldock.document.DocumentType;

/**
 * Reads identity fields off a scanned document held in S3.
 *
 * <p>Implementations are selected by {@link DocumentType}, so supporting a third kind of ID is a
 * new class and a {@code supports} clause — nothing else moves.
 *
 * <p>Implementations pass S3 <em>references</em> to Textract rather than bytes. The bucket and
 * the Textract client share a region (see TextractConfig), which is what that integration
 * requires, and it keeps ID scans out of the application heap entirely.
 */
public interface IdExtractor {

    boolean supports(DocumentType type);

    /**
     * @throws software.amazon.awssdk.services.textract.model.TextractException on a Textract
     *         error; the caller decides whether it is retryable.
     */
    ExtractedIdFields extract(String bucket, String s3Key);
}
