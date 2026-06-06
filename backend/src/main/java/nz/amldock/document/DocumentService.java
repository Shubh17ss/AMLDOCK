package nz.amldock.document;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlRequest;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
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

@Service
public class DocumentService {

    private final DocumentRepository documents;
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final OwnershipNodeRepository ownershipNodes;
    private final OwnershipStructureRepository ownershipStructures;
    private final UserRepository users;
    private final FileStorageService storage;
    private final DealLifecycleService lifecycle;
    private final AuditService audit;
    private final long maxBytes;
    private final Duration uploadTtl;
    private final Duration downloadTtl;

    public DocumentService(DocumentRepository documents,
                           DealRepository deals,
                           FirmBranchRepository branches,
                           OwnershipNodeRepository ownershipNodes,
                           OwnershipStructureRepository ownershipStructures,
                           UserRepository users,
                           FileStorageService storage,
                           DealLifecycleService lifecycle,
                           AuditService audit,
                           @Value("${S3_MAX_BYTES:26214400}") long maxBytes,
                           @Value("${S3_UPLOAD_TTL_MINUTES:5}") long uploadTtlMinutes,
                           @Value("${S3_DOWNLOAD_TTL_MINUTES:5}") long downloadTtlMinutes) {
        this.documents = documents;
        this.deals = deals;
        this.branches = branches;
        this.ownershipNodes = ownershipNodes;
        this.ownershipStructures = ownershipStructures;
        this.users = users;
        this.storage = storage;
        this.lifecycle = lifecycle;
        this.audit = audit;
        this.maxBytes = maxBytes;
        this.uploadTtl = Duration.ofMinutes(uploadTtlMinutes);
        this.downloadTtl = Duration.ofMinutes(downloadTtlMinutes);
    }

    @Transactional
    public UploadUrlResponse presignUpload(UploadUrlRequest req) {
        if (req.sizeBytes() > maxBytes) {
            throw new BadRequestException("File exceeds " + (maxBytes / 1024 / 1024) + " MB limit");
        }
        Deal deal = mustLoadDealForWrite(req.dealId());
        UserPrincipal actor = currentPrincipal();

        Long nodeId = null;
        if (req.ownershipNodeId() != null) {
            OwnershipNode node = ownershipNodes.findById(req.ownershipNodeId())
                    .orElseThrow(() -> new BadRequestException("Ownership node " + req.ownershipNodeId() + " not found"));
            OwnershipStructure structure = ownershipStructures.findById(node.getOwnershipStructureId())
                    .orElseThrow(() -> new BadRequestException("Ownership structure not found"));
            if (!deal.getId().equals(structure.getDealId())) {
                throw new BadRequestException("Ownership node does not belong to this deal");
            }
            nodeId = node.getId();
        }

        String key = buildKey(deal.getId(), nodeId, req.filename());

        Document d = new Document();
        d.setS3Key(key);
        d.setOriginalFilename(req.filename());
        d.setContentType(req.contentType());
        d.setSizeBytes(req.sizeBytes());
        d.setDocumentType(req.documentType());
        d.setStatus(DocumentStatus.PENDING);
        d.setDealId(deal.getId());
        d.setOwnershipNodeId(nodeId);
        d.setUploadedByUserId(actor.id());
        d.setOcrStatus(OcrStatus.NOT_APPLICABLE); // M5 sets PENDING for DL/PASSPORT
        Document saved = documents.save(d);

        String url = storage.presignUpload(key, req.contentType(), uploadTtl);
        return new UploadUrlResponse(saved.getId(), key, url, req.contentType(), (int) uploadTtl.toSeconds());
    }

    @Transactional
    public DocumentDto confirmUpload(Long documentId) {
        Document doc = documents.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Document " + documentId + " not found"));
        if (doc.getStatus() == DocumentStatus.ACTIVE) {
            return toDto(doc); // idempotent
        }
        if (doc.getStatus() == DocumentStatus.DELETED) {
            throw new BadRequestException("Document is deleted");
        }
        UserPrincipal actor = currentPrincipal();
        if (!actor.id().equals(doc.getUploadedByUserId()) && actor.role() != Role.MANAGER) {
            throw new ForbiddenException("Only the uploader (or a manager) may confirm this upload");
        }

        if (!storage.exists(doc.getS3Key())) {
            throw new BadRequestException("Object not found in S3 yet — was the upload successful?");
        }
        long actualSize = storage.size(doc.getS3Key());
        if (actualSize != doc.getSizeBytes()) {
            // Update to actual to keep DB honest.
            doc.setSizeBytes(actualSize);
        }
        doc.setStatus(DocumentStatus.ACTIVE);

        audit.record(AuditAction.DOCUMENT_UPLOADED, "Document", doc.getId(),
                "Uploaded " + doc.getOriginalFilename() + " for deal " + doc.getDealId());

        // M5 will hook OCR dispatch here for DL/PASSPORT.

        return toDto(doc);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> listForDeal(Long dealId) {
        Deal deal = mustLoadDealForRead(dealId);
        return documents.findAllByDealIdAndStatusOrderByCreatedAtDesc(deal.getId(), DocumentStatus.ACTIVE)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> listForNode(Long nodeId) {
        OwnershipNode node = ownershipNodes.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Ownership node " + nodeId + " not found"));
        OwnershipStructure structure = ownershipStructures.findById(node.getOwnershipStructureId())
                .orElseThrow(() -> new NotFoundException("Ownership structure not found"));
        // Reuse the deal-level read permission check so firm-user / broker scoping is honoured.
        mustLoadDealForRead(structure.getDealId());
        return documents.findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(node.getId(), DocumentStatus.ACTIVE)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto get(Long id) {
        Document d = mustLoadActiveForRead(id);
        return toDto(d);
    }

    // Not readOnly — writes a DOCUMENT_DOWNLOADED audit row.
    @Transactional
    public DownloadUrlResponse presignDownload(Long id) {
        Document d = mustLoadActiveForRead(id);
        String url = storage.presignDownload(d.getS3Key(), d.getOriginalFilename(), downloadTtl);
        audit.record(AuditAction.DOCUMENT_DOWNLOADED, "Document", d.getId(),
                "Download URL issued for " + d.getOriginalFilename());
        return new DownloadUrlResponse(url, (int) downloadTtl.toSeconds());
    }

    @Transactional
    public void delete(Long id) {
        Document d = documents.findById(id)
                .orElseThrow(() -> new NotFoundException("Document " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        if (!actor.id().equals(d.getUploadedByUserId()) && actor.role() != Role.MANAGER) {
            throw new ForbiddenException("Only the uploader or a manager may delete this document");
        }
        if (d.getStatus() == DocumentStatus.DELETED) return;

        storage.delete(d.getS3Key());
        d.setStatus(DocumentStatus.DELETED);
        audit.record(AuditAction.DOCUMENT_DELETED, "Document", d.getId(),
                "Deleted " + d.getOriginalFilename());
    }

    /* ---------- helpers ---------- */

    private Deal mustLoadDealForWrite(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new BadRequestException("Deal " + dealId + " not found"));
        UserPrincipal actor = currentPrincipal();
        // Brokers may upload to their own draft. Compliance/manager may upload to any visible deal.
        switch (actor.role()) {
            case BROKER -> {
                if (!actor.id().equals(deal.getCreatedByUserId())) {
                    throw new ForbiddenException("Not your deal");
                }
            }
            case COMPLIANCE, MANAGER -> { /* allowed */ }
            case FIRM_USER -> throw new ForbiddenException("Firm users may not upload documents");
        }
        return deal;
    }

    private Deal mustLoadDealForRead(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        Long firmId = branches.findById(deal.getFirmBranchId())
                .map(FirmBranch::getRealEstateFirmId).orElse(null);
        lifecycle.assertCanRead(deal, currentPrincipal(), firmId);
        return deal;
    }

    private Document mustLoadActiveForRead(Long id) {
        Document d = documents.findById(id)
                .orElseThrow(() -> new NotFoundException("Document " + id + " not found"));
        if (d.getStatus() == DocumentStatus.DELETED) {
            throw new NotFoundException("Document " + id + " not found");
        }
        if (d.getDealId() != null) {
            mustLoadDealForRead(d.getDealId());
        }
        return d;
    }

    private DocumentDto toDto(Document d) {
        String email = users.findById(d.getUploadedByUserId()).map(User::getEmail).orElse(null);
        return DocumentDto.from(d, email);
    }

    private String buildKey(Long dealId, Long nodeId, String filename) {
        String sanitised = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String prefix = nodeId == null
                ? "deals/" + dealId
                : "deals/" + dealId + "/nodes/" + nodeId;
        return prefix + "/" + UUID.randomUUID() + "-" + sanitised;
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
