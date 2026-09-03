package nz.amldock.deal.version;

import nz.amldock.deal.version.dto.DealVersionDto;
import nz.amldock.deal.version.dto.DealVersionSummaryDto;
import nz.amldock.document.dto.DownloadUrlResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Reading past versions of a deal.
 *
 * <p>No {@code @PreAuthorize} anywhere, matching the notes endpoints on {@code DealController} and
 * for the same reason: a version is exactly as readable as the deal it belongs to, and
 * {@code DealVersionReadService} runs {@code assertCanRead} against the live deal on every path.
 * A role annotation here would be a second, coarser rule that could only disagree with the first —
 * and it would disagree in the wrong direction, since a broker may read their own deal and should
 * be able to see what compliance signed off on it.
 *
 * <p>Write-side lives on {@code DealController} instead: verifying and reopening are lifecycle
 * verbs, and putting them here would split one state machine across two controllers.
 */
@RestController
@RequestMapping("/api/deals/{dealId}/versions")
public class DealVersionController {

    private final DealVersionReadService versions;

    public DealVersionController(DealVersionReadService versions) {
        this.versions = versions;
    }

    /** Newest first. Empty for a deal that has never been verified. */
    @GetMapping
    public List<DealVersionSummaryDto> list(@PathVariable Long dealId) {
        return versions.list(dealId);
    }

    /**
     * One version, as the whole deal it was.
     *
     * <p>Addressed by {@code versionNo} rather than the row id, because that is the number the
     * reviewer sees and the one that means something ("v2") — the surrogate key is nobody's
     * business outside these tables.
     */
    @GetMapping("/{versionNo}")
    public DealVersionDto get(@PathVariable Long dealId, @PathVariable Integer versionNo) {
        return versions.get(dealId, versionNo);
    }

    /**
     * A download URL for one of the version's documents.
     *
     * <p>Exists separately from {@code /api/documents/{id}/download} because that one serves only
     * ACTIVE documents. A document deleted from the deal after this version was signed off is not
     * active any more, and still has to be readable here — the evidence behind a sign-off does not
     * stop being evidence because the deal moved on.
     */
    @GetMapping("/{versionNo}/documents/{documentId}/download")
    public DownloadUrlResponse download(@PathVariable Long dealId,
                                        @PathVariable Integer versionNo,
                                        @PathVariable Long documentId) {
        return versions.presignDownload(dealId, versionNo, documentId);
    }
}
