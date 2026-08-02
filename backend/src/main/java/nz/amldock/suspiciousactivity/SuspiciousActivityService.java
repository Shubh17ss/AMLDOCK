package nz.amldock.suspiciousactivity;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.suspiciousactivity.dto.CreateSuspiciousActivityRequest;
import nz.amldock.suspiciousactivity.dto.SuspiciousActivityDto;
import nz.amldock.suspiciousactivity.dto.SuspiciousActivityUploadUrlRequest;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * The Suspicious Activity Register. Entries are scoped to a firm and optionally a branch; firm
 * resolution mirrors {@link nz.amldock.fundtransaction.InternationalFundTransactionService}
 * (ROOT may target any firm or the platform register, everyone else is pinned to their own).
 *
 * The supporting PDF is optional — the entry is created first and a document can be attached
 * afterwards through the same presign → PUT → confirm flow used for compliance documents.
 */
@Service
public class SuspiciousActivityService {

    private static final String ENTITY_TYPE = "SuspiciousActivity";

    private final SuspiciousActivityRepository activities;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final FileStorageService storage;
    private final AuditService audit;
    private final long maxBytes;
    private final Duration uploadTtl;
    private final Duration downloadTtl;

    public SuspiciousActivityService(SuspiciousActivityRepository activities,
                                     UserRepository users,
                                     FirmBranchRepository branches,
                                     FileStorageService storage,
                                     AuditService audit,
                                     @Value("${S3_MAX_BYTES:26214400}") long maxBytes,
                                     @Value("${S3_UPLOAD_TTL_MINUTES:5}") long uploadTtlMinutes,
                                     @Value("${S3_DOWNLOAD_TTL_MINUTES:5}") long downloadTtlMinutes) {
        this.activities = activities;
        this.users = users;
        this.branches = branches;
        this.storage = storage;
        this.audit = audit;
        this.maxBytes = maxBytes;
        this.uploadTtl = Duration.ofMinutes(uploadTtlMinutes);
        this.downloadTtl = Duration.ofMinutes(downloadTtlMinutes);
    }

    /** The register in the selected scope, newest date of suspicion first. */
    @Transactional(readOnly = true)
    public List<SuspiciousActivityDto> list(Long requestedFirmId, Long branchId) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, requestedFirmId);
        Long resolvedBranch = resolveBranch(branchId, firmId);
        return activities.findAllScoped(firmId, resolvedBranch).stream().map(this::toDto).toList();
    }

    @Transactional
    public SuspiciousActivityDto create(CreateSuspiciousActivityRequest req) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);

        SuspiciousActivity s = new SuspiciousActivity();
        s.setSuspicionType(req.suspicionType());
        s.setAmountNzd(resolveAmount(req.suspicionType(), req.amountNzd()));
        s.setName(req.name().trim());
        s.setDateOfSuspicion(req.dateOfSuspicion());
        s.setRedFlag(req.redFlag());
        s.setReference(trimToNull(req.reference()));
        s.setDescription(req.description().trim());
        s.setActionTaken(trimToNull(req.actionTaken()));
        s.setRealEstateFirmId(firmId);
        s.setFirmBranchId(branchId);
        s.setCreatedByUserId(actor.id());
        SuspiciousActivity saved = activities.save(s);

        // The summary stays deliberately short — the free-text description is not copied into
        // the audit log, which is visible to ROOT across firms.
        audit.record(AuditAction.SUSPICIOUS_ACTIVITY_CREATED, ENTITY_TYPE, saved.getId(),
                "Logged suspicious " + saved.getSuspicionType() + " for " + saved.getName()
                        + " (" + saved.getRedFlag() + ")");
        return toDto(saved);
    }

    /** Presign the entry's supporting PDF. Replaces any previously attached file. */
    @Transactional
    public UploadUrlResponse presignUpload(Long id, SuspiciousActivityUploadUrlRequest req) {
        if (req.sizeBytes() > maxBytes) {
            throw new BadRequestException("File exceeds " + (maxBytes / 1024 / 1024) + " MB limit");
        }
        // Register attachments are PDF-only, same guard as compliance documents.
        boolean pdfContentType = "application/pdf".equalsIgnoreCase(req.contentType());
        boolean pdfExtension = req.filename() != null && req.filename().toLowerCase().endsWith(".pdf");
        if (!pdfContentType || !pdfExtension) {
            throw new BadRequestException("Only PDF files can be uploaded");
        }
        SuspiciousActivity s = activities.findById(id)
                .orElseThrow(() -> new NotFoundException("Suspicious activity " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        assertSameScope(actor, s);

        // A re-upload supersedes the old object; drop it so nothing is orphaned in S3.
        if (s.getS3Key() != null) {
            storage.delete(s.getS3Key());
        }
        String key = buildKey(s.getRealEstateFirmId(), s.getId(), req.filename());
        s.setS3Key(key);
        s.setOriginalFilename(req.filename());
        s.setContentType(req.contentType());
        s.setSizeBytes(req.sizeBytes());
        s.setDocumentStatus(DocumentStatus.PENDING);

        String url = storage.presignUpload(key, req.contentType(), uploadTtl);
        return new UploadUrlResponse(s.getId(), key, url, req.contentType(), (int) uploadTtl.toSeconds());
    }

    @Transactional
    public SuspiciousActivityDto confirmUpload(Long id) {
        SuspiciousActivity s = activities.findById(id)
                .orElseThrow(() -> new NotFoundException("Suspicious activity " + id + " not found"));
        if (s.getDocumentStatus() == DocumentStatus.ACTIVE) {
            return toDto(s); // idempotent
        }
        if (s.getDocumentStatus() == null || s.getS3Key() == null) {
            throw new BadRequestException("No upload was started for this entry");
        }
        UserPrincipal actor = currentPrincipal();
        assertSameScope(actor, s);

        if (!storage.exists(s.getS3Key())) {
            throw new BadRequestException("Object not found in S3 yet — was the upload successful?");
        }
        long actualSize = storage.size(s.getS3Key());
        if (s.getSizeBytes() == null || actualSize != s.getSizeBytes()) {
            s.setSizeBytes(actualSize);
        }
        s.setDocumentStatus(DocumentStatus.ACTIVE);

        audit.record(AuditAction.DOCUMENT_UPLOADED, ENTITY_TYPE, s.getId(),
                "Attached " + s.getOriginalFilename() + " to suspicious activity " + s.getId());
        return toDto(s);
    }

    // Not readOnly — writes a DOCUMENT_DOWNLOADED audit row.
    @Transactional
    public DownloadUrlResponse presignDownload(Long id) {
        SuspiciousActivity s = activities.findById(id)
                .orElseThrow(() -> new NotFoundException("Suspicious activity " + id + " not found"));
        if (s.getDocumentStatus() != DocumentStatus.ACTIVE || s.getS3Key() == null) {
            throw new NotFoundException("Suspicious activity " + id + " has no attached document");
        }
        assertSameScope(currentPrincipal(), s);
        String url = storage.presignDownload(s.getS3Key(), s.getOriginalFilename(), downloadTtl);
        audit.record(AuditAction.DOCUMENT_DOWNLOADED, ENTITY_TYPE, s.getId(),
                "Download URL issued for " + s.getOriginalFilename());
        return new DownloadUrlResponse(url, (int) downloadTtl.toSeconds());
    }

    /** Deletes are restricted to ROOT and SENIOR_MANAGER (also gated by @PreAuthorize). */
    @Transactional
    public void delete(Long id) {
        SuspiciousActivity s = activities.findById(id)
                .orElseThrow(() -> new NotFoundException("Suspicious activity " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        if (actor.role() != Role.ROOT && actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only ROOT or a senior manager may delete a register entry");
        }
        if (actor.role() != Role.ROOT) assertSameScope(actor, s);

        if (s.getS3Key() != null) {
            storage.delete(s.getS3Key());
        }
        // The register row is removed outright — the audit trail is the durable record.
        activities.delete(s);
        audit.record(AuditAction.SUSPICIOUS_ACTIVITY_DELETED, ENTITY_TYPE, id,
                "Deleted suspicious " + s.getSuspicionType() + " for " + s.getName()
                        + " (" + s.getRedFlag() + ")");
    }

    /* ---------- helpers ---------- */

    /**
     * An amount belongs to a transaction and nothing else: it is required there, and discarded
     * for an activity so a stale value can't linger on the row.
     */
    private static BigDecimal resolveAmount(SuspicionType type, BigDecimal amount) {
        if (type != SuspicionType.TRANSACTION) return null;
        if (amount == null) {
            throw new BadRequestException("An amount is required for a suspicious transaction");
        }
        if (amount.signum() < 0) {
            throw new BadRequestException("The amount cannot be negative");
        }
        return amount;
    }

    /** ROOT may target any firm (or the platform register when null); everyone else is pinned to their own. */
    private static Long resolveTargetFirm(UserPrincipal actor, Long requestedFirmId) {
        if (actor.role() == Role.ROOT) return requestedFirmId;
        return actor.realEstateFirmId();
    }

    /** A branch tag must belong to the target firm; null means firm-wide. */
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

    /** A user may only touch entries in their own firm's register (ROOT: any, incl. the firm-less one). */
    private static void assertSameScope(UserPrincipal actor, SuspiciousActivity s) {
        boolean sameFirm = actor.realEstateFirmId() == null
                ? s.getRealEstateFirmId() == null
                : actor.realEstateFirmId().equals(s.getRealEstateFirmId());
        if (!sameFirm && actor.role() != Role.ROOT) {
            throw new ForbiddenException("This entry belongs to another firm");
        }
    }

    private SuspiciousActivityDto toDto(SuspiciousActivity s) {
        String email = users.findById(s.getCreatedByUserId()).map(User::getEmail).orElse(null);
        String branchName = s.getFirmBranchId() == null
                ? null
                : branches.findById(s.getFirmBranchId()).map(FirmBranch::getName).orElse(null);
        return SuspiciousActivityDto.from(s, branchName, email);
    }

    private String buildKey(Long firmId, Long activityId, String filename) {
        String sanitised = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String scope = firmId == null ? "platform" : "firms/" + firmId;
        return "suspicious-activities/" + scope + "/" + activityId + "/" + UUID.randomUUID() + "-" + sanitised;
    }

    private static String trimToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
