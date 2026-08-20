package nz.amldock.document.ocr;

/**
 * Moves queued documents through extraction.
 *
 * <p>An interface with a single implementation on purpose. The queue itself is
 * {@code document.ocr_status}, which is written in the same transaction as the document going
 * ACTIVE — so work item and data commit together and neither can exist without the other. Putting
 * SQS in front of that would reintroduce the dual-write it avoids, and its real benefits (push
 * latency, a managed DLQ, a Lambda trigger) do not bind at a few ID scans per deal.
 *
 * <p>When they do, an {@code SqsIdExtractionDispatcher} implements this and nothing else moves.
 * That is the whole reason the seam exists.
 */
public interface IdExtractionDispatcher {

    /** Claims whatever is due and runs it to completion. Safe to call concurrently. */
    void pump();
}
