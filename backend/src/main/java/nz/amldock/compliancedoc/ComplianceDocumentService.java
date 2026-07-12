package nz.amldock.compliancedoc;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.compliancedoc.dto.ComplianceDocumentDto;
import nz.amldock.compliancedoc.dto.ComplianceUploadUrlRequest;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Firm-level compliance documents (risk assessment / compliance programme / annual report).
 * Versioned per firm + category; bytes flow client-to-S3 via the same presigned flow as
 * deal documents. Scope: users see their own firm's register; ROOT manages a platform-level
 * (firm-less) register.
 */
@Service
public class ComplianceDocumentService {

    private final ComplianceDocumentRepository docs;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final FileStorageService storage;
    private final AuditService audit;
    private final long maxBytes;
    private final Duration uploadTtl;
    private final Duration downloadTtl;

    public ComplianceDocumentService(ComplianceDocumentRepository docs,
                                     UserRepository users,
                                     FirmBranchRepository branches,
                                     FileStorageService storage,
                                     AuditService audit,
                                     @Value("${S3_MAX_BYTES:26214400}") long maxBytes,
                                     @Value("${S3_UPLOAD_TTL_MINUTES:5}") long uploadTtlMinutes,
                                     @Value("${S3_DOWNLOAD_TTL_MINUTES:5}") long downloadTtlMinutes) {
        this.docs = docs;
        this.users = users;
        this.branches = branches;
        this.storage = storage;
        this.audit = audit;
        this.maxBytes = maxBytes;
        this.uploadTtl = Duration.ofMinutes(uploadTtlMinutes);
        this.downloadTtl = Duration.ofMinutes(downloadTtlMinutes);
    }

    @Transactional
    public UploadUrlResponse presignUpload(ComplianceUploadUrlRequest req) {
        if (req.sizeBytes() > maxBytes) {
            throw new BadRequestException("File exceeds " + (maxBytes / 1024 / 1024) + " MB limit");
        }
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);

        int nextVersion = (firmId == null
                ? docs.findTopByCategoryAndRealEstateFirmIdIsNullOrderByVersionNoDesc(req.category())
                : docs.findTopByCategoryAndRealEstateFirmIdOrderByVersionNoDesc(req.category(), firmId))
                .map(d -> d.getVersionNo() + 1).orElse(1);

        String key = buildKey(firmId, req.category(), req.filename());

        ComplianceDocument d = new ComplianceDocument();
        d.setCategory(req.category());
        d.setName(req.name().trim());
        d.setChangeNotes(req.changeNotes() == null || req.changeNotes().isBlank() ? null : req.changeNotes().trim());
        d.setVersionNo(nextVersion);
        d.setS3Key(key);
        d.setOriginalFilename(req.filename());
        d.setContentType(req.contentType());
        d.setSizeBytes(req.sizeBytes());
        d.setStatus(DocumentStatus.PENDING);
        d.setRealEstateFirmId(firmId);
        d.setFirmBranchId(branchId);
        d.setUploadedByUserId(actor.id());
        ComplianceDocument saved = docs.save(d);

        String url = storage.presignUpload(key, req.contentType(), uploadTtl);
        return new UploadUrlResponse(saved.getId(), key, url, req.contentType(), (int) uploadTtl.toSeconds());
    }

    @Transactional
    public ComplianceDocumentDto confirmUpload(Long documentId) {
        ComplianceDocument doc = docs.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Document " + documentId + " not found"));
        if (doc.getStatus() == DocumentStatus.ACTIVE) {
            return toDto(doc); // idempotent
        }
        if (doc.getStatus() == DocumentStatus.DELETED) {
            throw new BadRequestException("Document is deleted");
        }
        UserPrincipal actor = currentPrincipal();
        assertSameScope(actor, doc);

        if (!storage.exists(doc.getS3Key())) {
            throw new BadRequestException("Object not found in S3 yet — was the upload successful?");
        }
        long actualSize = storage.size(doc.getS3Key());
        if (actualSize != doc.getSizeBytes()) {
            doc.setSizeBytes(actualSize);
        }
        doc.setStatus(DocumentStatus.ACTIVE);

        audit.record(AuditAction.DOCUMENT_UPLOADED, "ComplianceDocument", doc.getId(),
                "Uploaded " + doc.getName() + " (v" + doc.getVersionNo() + ", " + doc.getCategory() + ")");

        return toDto(doc);
    }

    /**
     * Versions in the selected scope. Firm resolves like uploads (ROOT may pick any
     * firm; others are pinned to their own). A branch narrows strictly to that
     * branch's revisions; no branch selected shows the whole firm register.
     */
    @Transactional(readOnly = true)
    public List<ComplianceDocumentDto> list(ComplianceDocCategory category, Long requestedFirmId, Long branchId) {
        Long firmId = resolveTargetFirm(currentPrincipal(), requestedFirmId);
        List<ComplianceDocument> rows = firmId == null
                ? docs.findAllByCategoryAndRealEstateFirmIdIsNullAndStatusOrderByVersionNoDesc(category, DocumentStatus.ACTIVE)
                : docs.findAllByCategoryAndRealEstateFirmIdAndStatusOrderByVersionNoDesc(category, firmId, DocumentStatus.ACTIVE);
        return rows.stream()
                .filter((d) -> branchId == null || branchId.equals(d.getFirmBranchId()))
                .map(this::toDto).toList();
    }

    // Not readOnly — writes a DOCUMENT_DOWNLOADED audit row.
    @Transactional
    public DownloadUrlResponse presignDownload(Long id) {
        ComplianceDocument d = docs.findById(id)
                .orElseThrow(() -> new NotFoundException("Document " + id + " not found"));
        if (d.getStatus() != DocumentStatus.ACTIVE) {
            throw new NotFoundException("Document " + id + " not found");
        }
        assertSameScope(currentPrincipal(), d);
        String url = storage.presignDownload(d.getS3Key(), d.getOriginalFilename(), downloadTtl);
        audit.record(AuditAction.DOCUMENT_DOWNLOADED, "ComplianceDocument", d.getId(),
                "Download URL issued for " + d.getName() + " (v" + d.getVersionNo() + ")");
        return new DownloadUrlResponse(url, (int) downloadTtl.toSeconds());
    }

    /** Deletes are restricted to ROOT and SENIOR_MANAGER (gated by @PreAuthorize on the controller). */
    @Transactional
    public void delete(Long id) {
        ComplianceDocument d = docs.findById(id)
                .orElseThrow(() -> new NotFoundException("Document " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        if (actor.role() != Role.ROOT && actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only ROOT or a senior manager may delete a document");
        }
        if (actor.role() != Role.ROOT) assertSameScope(actor, d);
        if (d.getStatus() == DocumentStatus.DELETED) return;

        storage.delete(d.getS3Key());
        d.setStatus(DocumentStatus.DELETED);
        audit.record(AuditAction.DOCUMENT_DELETED, "ComplianceDocument", d.getId(),
                "Deleted " + d.getName() + " (v" + d.getVersionNo() + ")");
    }

    /* ---------- helpers ---------- */

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

    /** A user may only touch documents in their own firm's register (ROOT: the firm-less register). */
    private static void assertSameScope(UserPrincipal actor, ComplianceDocument doc) {
        boolean sameFirm = actor.realEstateFirmId() == null
                ? doc.getRealEstateFirmId() == null
                : actor.realEstateFirmId().equals(doc.getRealEstateFirmId());
        if (!sameFirm && actor.role() != Role.ROOT) {
            throw new ForbiddenException("This document belongs to another firm");
        }
    }

    private ComplianceDocumentDto toDto(ComplianceDocument d) {
        String email = users.findById(d.getUploadedByUserId()).map(User::getEmail).orElse(null);
        String branchName = d.getFirmBranchId() == null
                ? null
                : branches.findById(d.getFirmBranchId()).map(FirmBranch::getName).orElse(null);
        return ComplianceDocumentDto.from(d, branchName, email);
    }

    private String buildKey(Long firmId, ComplianceDocCategory category, String filename) {
        String sanitised = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String scope = firmId == null ? "platform" : "firms/" + firmId;
        return "compliance/" + scope + "/" + category.name().toLowerCase() + "/" + UUID.randomUUID() + "-" + sanitised;
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
