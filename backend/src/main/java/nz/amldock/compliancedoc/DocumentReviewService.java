package nz.amldock.compliancedoc;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.compliancedoc.dto.CompleteReviewRequest;
import nz.amldock.compliancedoc.dto.DocumentReviewDto;
import nz.amldock.compliancedoc.dto.SetReviewDateRequest;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The review schedule behind each compliance-document register. One row per scope
 * (firm + optional branch) + category holds the next review due date and the last
 * "mark complete" stamp; the derived status (unset / overdue / on-track) drives the
 * card indicator. Firm resolution mirrors {@link ComplianceDocumentService}: ROOT may
 * target any firm (or the platform register), everyone else is pinned to their own.
 */
@Service
public class DocumentReviewService {

    private static final String ENTITY_TYPE = "DocumentReview";

    private final DocumentReviewRepository reviews;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final AuditService audit;

    public DocumentReviewService(DocumentReviewRepository reviews,
                                 UserRepository users,
                                 FirmBranchRepository branches,
                                 AuditService audit) {
        this.reviews = reviews;
        this.users = users;
        this.branches = branches;
        this.audit = audit;
    }

    /** Every category's review status in the selected scope, filling UNSET for unconfigured ones. */
    @Transactional(readOnly = true)
    public List<DocumentReviewDto> list(Long requestedFirmId, Long branchId) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, requestedFirmId);
        Long resolvedBranch = resolveBranch(branchId, firmId);
        LocalDate today = LocalDate.now();

        Map<ComplianceDocCategory, DocumentReview> byCategory = new HashMap<>();
        for (DocumentReview r : reviews.findAllScoped(firmId, resolvedBranch)) {
            byCategory.put(r.getCategory(), r);
        }
        return java.util.Arrays.stream(ComplianceDocCategory.values())
                .map((c) -> {
                    DocumentReview r = byCategory.get(c);
                    return r == null ? DocumentReviewDto.empty(c) : toDto(r, today);
                })
                .toList();
    }

    @Transactional
    public DocumentReviewDto setReviewDate(SetReviewDateRequest req) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);

        DocumentReview r = reviews.findScoped(req.category(), firmId, branchId)
                .orElseGet(() -> {
                    DocumentReview fresh = new DocumentReview();
                    fresh.setCategory(req.category());
                    fresh.setRealEstateFirmId(firmId);
                    fresh.setFirmBranchId(branchId);
                    return fresh;
                });
        r.setNextReviewDate(req.nextReviewDate());
        DocumentReview saved = reviews.save(r);

        audit.record(AuditAction.DOCUMENT_REVIEW_SET, ENTITY_TYPE, saved.getId(),
                "Set " + req.category() + " review date to "
                        + (req.nextReviewDate() == null ? "none" : req.nextReviewDate()));
        return toDto(saved, LocalDate.now());
    }

    @Transactional
    public DocumentReviewDto markComplete(CompleteReviewRequest req) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);

        DocumentReview r = reviews.findScoped(req.category(), firmId, branchId)
                .orElseGet(() -> {
                    DocumentReview fresh = new DocumentReview();
                    fresh.setCategory(req.category());
                    fresh.setRealEstateFirmId(firmId);
                    fresh.setFirmBranchId(branchId);
                    return fresh;
                });
        r.setLastCompletedAt(Instant.now());
        r.setLastCompletedByUserId(actor.id());
        DocumentReview saved = reviews.save(r);

        audit.record(AuditAction.DOCUMENT_REVIEW_COMPLETED, ENTITY_TYPE, saved.getId(),
                "Marked " + req.category() + " review complete");
        return toDto(saved, LocalDate.now());
    }

    /* ---------- helpers ---------- */

    private static Long resolveTargetFirm(UserPrincipal actor, Long requestedFirmId) {
        if (actor.role() == Role.ROOT) return requestedFirmId;
        return actor.realEstateFirmId();
    }

    private Long resolveBranch(Long branchId, Long firmId) {
        if (branchId == null) return null;
        if (firmId == null) throw new BadRequestException("A branch requires a firm");
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));
        if (!firmId.equals(branch.getRealEstateFirmId())) {
            throw new BadRequestException("Branch does not belong to this firm");
        }
        return branch.getId();
    }

    private DocumentReviewDto toDto(DocumentReview r, LocalDate today) {
        String email = r.getLastCompletedByUserId() == null ? null
                : users.findById(r.getLastCompletedByUserId()).map(User::getEmail).orElse(null);
        return DocumentReviewDto.from(r, today, email);
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
