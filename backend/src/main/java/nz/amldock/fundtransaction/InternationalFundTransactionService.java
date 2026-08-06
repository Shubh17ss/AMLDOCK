package nz.amldock.fundtransaction;

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
import nz.amldock.fundtransaction.dto.CreateFundTransactionRequest;
import nz.amldock.fundtransaction.dto.FundTransactionDto;
import nz.amldock.fundtransaction.dto.FundTransactionUploadUrlRequest;
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
 * The International Fund Transaction Register. Entries are scoped to a firm and optionally a
 * branch; firm resolution mirrors {@link nz.amldock.compliancedoc.ComplianceDocumentService}
 * (ROOT may target any firm or the platform register, everyone else is pinned to their own).
 *
 * The supporting PDF is optional — the entry is created first and a document can be attached
 * afterwards through the same presign → PUT → confirm flow used for compliance documents.
 */
@Service
public class InternationalFundTransactionService {

    private static final String ENTITY_TYPE = "InternationalFundTransaction";

    private final InternationalFundTransactionRepository transactions;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final FileStorageService storage;
    private final AuditService audit;
    private final long maxBytes;
    private final Duration uploadTtl;
    private final Duration downloadTtl;

    public InternationalFundTransactionService(InternationalFundTransactionRepository transactions,
                                              UserRepository users,
                                              FirmBranchRepository branches,
                                              FileStorageService storage,
                                              AuditService audit,
                                              @Value("${S3_MAX_BYTES:26214400}") long maxBytes,
                                              @Value("${S3_UPLOAD_TTL_MINUTES:5}") long uploadTtlMinutes,
                                              @Value("${S3_DOWNLOAD_TTL_MINUTES:5}") long downloadTtlMinutes) {
        this.transactions = transactions;
        this.users = users;
        this.branches = branches;
        this.storage = storage;
        this.audit = audit;
        this.maxBytes = maxBytes;
        this.uploadTtl = Duration.ofMinutes(uploadTtlMinutes);
        this.downloadTtl = Duration.ofMinutes(downloadTtlMinutes);
    }

    /** The register in the selected scope, newest transaction date first. */
    @Transactional(readOnly = true)
    public List<FundTransactionDto> list(Long requestedFirmId, Long branchId) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, requestedFirmId);
        Long resolvedBranch = resolveBranch(branchId, firmId);
        return transactions.findAllScoped(firmId, resolvedBranch).stream().map(this::toDto).toList();
    }

    @Transactional
    public FundTransactionDto create(CreateFundTransactionRequest req) {
        UserPrincipal actor = currentPrincipal();
        Long firmId = resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);

        InternationalFundTransaction t = new InternationalFundTransaction();
        t.setDealReference(trimToNull(req.dealReference()));
        t.setListingAddress(req.listingAddress().trim());
        t.setTransactionFlow(req.transactionFlow());
        t.setTransactionDate(req.transactionDate());
        t.setAmount(req.amount());
        t.setOverseasJurisdiction(req.overseasJurisdiction().trim().toUpperCase());
        t.setSubmissionReference(trimToNull(req.submissionReference()));
        t.setRealEstateFirmId(firmId);
        t.setFirmBranchId(branchId);
        t.setCreatedByUserId(actor.id());
        InternationalFundTransaction saved = transactions.save(t);

        audit.record(AuditAction.FUND_TRANSACTION_CREATED, ENTITY_TYPE, saved.getId(),
                // No currency word: the amount is in the entity's own currency, which this
                // service doesn't resolve. Naming the wrong one in an audit record is worse
                // than naming none.
                "Logged " + saved.getTransactionFlow() + " transfer of " + saved.getAmount()
                        + " with " + saved.getOverseasJurisdiction() + " for " + saved.getListingAddress());
        return toDto(saved);
    }

    /** Presign the entry's supporting PDF. Replaces any previously attached file. */
    @Transactional
    public UploadUrlResponse presignUpload(Long id, FundTransactionUploadUrlRequest req) {
        if (req.sizeBytes() > maxBytes) {
            throw new BadRequestException("File exceeds " + (maxBytes / 1024 / 1024) + " MB limit");
        }
        // Register attachments are PDF-only, same guard as compliance documents.
        boolean pdfContentType = "application/pdf".equalsIgnoreCase(req.contentType());
        boolean pdfExtension = req.filename() != null && req.filename().toLowerCase().endsWith(".pdf");
        if (!pdfContentType || !pdfExtension) {
            throw new BadRequestException("Only PDF files can be uploaded");
        }
        InternationalFundTransaction t = transactions.findById(id)
                .orElseThrow(() -> new NotFoundException("Transaction " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        assertSameScope(actor, t);

        // A re-upload supersedes the old object; drop it so nothing is orphaned in S3.
        if (t.getS3Key() != null) {
            storage.delete(t.getS3Key());
        }
        String key = buildKey(t.getRealEstateFirmId(), t.getId(), req.filename());
        t.setS3Key(key);
        t.setOriginalFilename(req.filename());
        t.setContentType(req.contentType());
        t.setSizeBytes(req.sizeBytes());
        t.setDocumentStatus(DocumentStatus.PENDING);

        String url = storage.presignUpload(key, req.contentType(), uploadTtl);
        return new UploadUrlResponse(t.getId(), key, url, req.contentType(), (int) uploadTtl.toSeconds());
    }

    @Transactional
    public FundTransactionDto confirmUpload(Long id) {
        InternationalFundTransaction t = transactions.findById(id)
                .orElseThrow(() -> new NotFoundException("Transaction " + id + " not found"));
        if (t.getDocumentStatus() == DocumentStatus.ACTIVE) {
            return toDto(t); // idempotent
        }
        if (t.getDocumentStatus() == null || t.getS3Key() == null) {
            throw new BadRequestException("No upload was started for this transaction");
        }
        UserPrincipal actor = currentPrincipal();
        assertSameScope(actor, t);

        if (!storage.exists(t.getS3Key())) {
            throw new BadRequestException("Object not found in S3 yet — was the upload successful?");
        }
        long actualSize = storage.size(t.getS3Key());
        if (t.getSizeBytes() == null || actualSize != t.getSizeBytes()) {
            t.setSizeBytes(actualSize);
        }
        t.setDocumentStatus(DocumentStatus.ACTIVE);

        audit.record(AuditAction.DOCUMENT_UPLOADED, ENTITY_TYPE, t.getId(),
                "Attached " + t.getOriginalFilename() + " to fund transaction " + t.getId());
        return toDto(t);
    }

    // Not readOnly — writes a DOCUMENT_DOWNLOADED audit row.
    @Transactional
    public DownloadUrlResponse presignDownload(Long id) {
        InternationalFundTransaction t = transactions.findById(id)
                .orElseThrow(() -> new NotFoundException("Transaction " + id + " not found"));
        if (t.getDocumentStatus() != DocumentStatus.ACTIVE || t.getS3Key() == null) {
            throw new NotFoundException("Transaction " + id + " has no attached document");
        }
        assertSameScope(currentPrincipal(), t);
        String url = storage.presignDownload(t.getS3Key(), t.getOriginalFilename(), downloadTtl);
        audit.record(AuditAction.DOCUMENT_DOWNLOADED, ENTITY_TYPE, t.getId(),
                "Download URL issued for " + t.getOriginalFilename());
        return new DownloadUrlResponse(url, (int) downloadTtl.toSeconds());
    }

    /** Deletes are restricted to ROOT and SENIOR_MANAGER (also gated by @PreAuthorize). */
    @Transactional
    public void delete(Long id) {
        InternationalFundTransaction t = transactions.findById(id)
                .orElseThrow(() -> new NotFoundException("Transaction " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        if (actor.role() != Role.ROOT && actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only ROOT or a senior manager may delete a register entry");
        }
        if (actor.role() != Role.ROOT) assertSameScope(actor, t);

        if (t.getS3Key() != null) {
            storage.delete(t.getS3Key());
        }
        // The register row is removed outright — the audit trail is the durable record.
        transactions.delete(t);
        audit.record(AuditAction.FUND_TRANSACTION_DELETED, ENTITY_TYPE, id,
                "Deleted " + t.getTransactionFlow() + " transfer of " + t.getAmount()
                        + " for " + t.getListingAddress());
    }

    /* ---------- helpers ---------- */

    /** ROOT may target any firm (or the platform register when null); everyone else is pinned to their own. */
    private static Long resolveTargetFirm(UserPrincipal actor, Long requestedFirmId) {
        if (actor.role().seesAllFirms()) return requestedFirmId;
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
    private static void assertSameScope(UserPrincipal actor, InternationalFundTransaction t) {
        boolean sameFirm = actor.realEstateFirmId() == null
                ? t.getRealEstateFirmId() == null
                : actor.realEstateFirmId().equals(t.getRealEstateFirmId());
        if (!sameFirm && !actor.role().seesAllFirms()) {
            throw new ForbiddenException("This transaction belongs to another firm");
        }
    }

    private FundTransactionDto toDto(InternationalFundTransaction t) {
        String email = users.findById(t.getCreatedByUserId()).map(User::getEmail).orElse(null);
        String branchName = t.getFirmBranchId() == null
                ? null
                : branches.findById(t.getFirmBranchId()).map(FirmBranch::getName).orElse(null);
        return FundTransactionDto.from(t, branchName, email);
    }

    private String buildKey(Long firmId, Long transactionId, String filename) {
        String sanitised = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String scope = firmId == null ? "platform" : "firms/" + firmId;
        return "fund-transactions/" + scope + "/" + transactionId + "/" + UUID.randomUUID() + "-" + sanitised;
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
