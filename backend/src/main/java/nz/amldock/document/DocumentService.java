package nz.amldock.document;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.version.DealVersionDocumentRepository;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlRequest;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.VerificationReset;
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
import java.time.Instant;
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
    private final BeneficialOwnerService beneficialOwners;
    private final AuditService audit;
    /** Asked before an S3 object is removed: is a verified version still pointing at it? */
    private final DealVersionDocumentRepository versionDocuments;
    private final VerificationReset verificationReset;
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
                           BeneficialOwnerService beneficialOwners,
                           AuditService audit,
                           DealVersionDocumentRepository versionDocuments,
                           VerificationReset verificationReset,
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
        this.beneficialOwners = beneficialOwners;
        this.audit = audit;
        this.versionDocuments = versionDocuments;
        this.verificationReset = verificationReset;
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
            // Checked here, not only in the picker. A restriction that lives in a dropdown is a
            // suggestion — this is the point every upload has to pass through.
            assertAccepts(node, req.documentType());
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
        // Carried from the request so confirmUpload knows whether this scan joins an existing
        // person (the back of a card) or starts a new one. That person must be on this deal:
        // deleting the scan and reading it both act on them, so a foreign id would let one
        // deal's author rewrite or remove another deal's individual.
        if (req.beneficialOwnerId() != null && !beneficialOwners.isOnDeal(deal.getId(), req.beneficialOwnerId())) {
            throw new BadRequestException("Individual does not belong to this deal");
        }
        d.setBeneficialOwnerId(req.beneficialOwnerId());
        d.setIdSide(req.idSide());
        d.setUploadedByUserId(actor.id());
        // Stays NOT_APPLICABLE until the bytes are provably in S3 — confirmUpload promotes
        // OCR-eligible types to PENDING. Queueing here instead would fill the pending index
        // with abandoned presigns whose objects never arrived.
        d.setOcrStatus(OcrStatus.NOT_APPLICABLE);
        Document saved = documents.save(d);

        String url = storage.presignIncomingUpload(key, req.contentType(), uploadTtl);
        return new UploadUrlResponse(saved.getId(), key, url, req.contentType(), (int) uploadTtl.toSeconds());
    }

    @Transactional
    public DocumentDto confirmUpload(Long documentId) {
        Document doc = documents.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Document " + documentId + " not found"));
        // Authorise before anything is returned: the ids are sequential, so the idempotent
        // ACTIVE return below must never hand a document to someone who could not read its
        // deal — the same scope GET /api/documents/{id} applies.
        UserPrincipal actor = currentPrincipal();
        if (doc.getDealId() != null) {
            mustLoadDealForRead(doc.getDealId());
        }
        if (doc.getStatus() == DocumentStatus.DELETED) {
            throw new BadRequestException("Document is deleted");
        }
        if (!actor.id().equals(doc.getUploadedByUserId()) && !canManageDocuments(actor.role())) {
            throw new ForbiddenException("Only the uploader (or an elevated role) may confirm this upload");
        }
        if (doc.getStatus() == DocumentStatus.ACTIVE) {
            return toDto(doc); // idempotent
        }
        // Again here, not only at presign: the deal can be verified between the two calls, and
        // confirming is the step that makes the document live and creates its provisional owner.
        if (doc.getDealId() != null) {
            mustLoadDealForWrite(doc.getDealId());
        }

        // Moves the bytes off the key the presigned URL writes to, so that URL can no longer
        // change what was confirmed (F7).
        long actualSize = storage.promoteUpload(doc.getS3Key()).orElseThrow(
                () -> new BadRequestException("Object not found in S3 yet — was the upload successful?"));
        if (actualSize != doc.getSizeBytes()) {
            // Update to actual to keep DB honest.
            doc.setSizeBytes(actualSize);
        }
        doc.setStatus(DocumentStatus.ACTIVE);

        audit.record(AuditAction.DOCUMENT_UPLOADED, "Document", doc.getId(),
                "Uploaded " + doc.getOriginalFilename() + " for deal " + doc.getDealId());

        // Queue identity documents for extraction. The object is confirmed present in S3 by this
        // point, so anything in the queue is genuinely processable.
        //
        // This write is the whole reason the queue lives in the database: it commits in the same
        // transaction as the document going ACTIVE, so the work item and the row it refers to can
        // never disagree. See ScheduledIdExtractionDispatcher, which drains it.
        // A document attached to an ownership node is filed against a person who is already in
        // the structure — evidence about them, not the discovery of someone new. Without this,
        // a reviewer attaching a passport on a node's Documents tab creates a *second*
        // individual on the deal, which is the opposite of what attaching it to a node means.
        // It is also why an ID added there is never read: there is no person record for
        // extraction to write into, so the Textract call would be spend with nowhere to land.
        boolean filedAgainstNode = doc.getOwnershipNodeId() != null;

        if (doc.getDocumentType().isOcrEligible() && !filedAgainstNode) {
            doc.setOcrStatus(OcrStatus.PENDING);
            // Due now. Never NULL while claimable: the claim's index orders by this (V60).
            doc.setOcrNextAttemptAt(Instant.now());

            // The individual exists from here, not from a successful extraction. A broker who
            // scans an ID sees a person appear straight away, and still does when Textract
            // cannot read the card — an unreadable scan is still evidence someone was presented.
            if (doc.getBeneficialOwnerId() == null) {
                doc.setBeneficialOwnerId(beneficialOwners.createProvisional(doc).getId());
            }
            // A scan with no side named is the front; a back is only ever explicit.
            if (doc.getIdSide() == null) {
                doc.setIdSide(IdSide.FRONT);
            }
        }

        // New evidence on an owner already verified: the decision did not see it.
        verificationReset.clearForDocument(doc, "document added");

        return toDto(doc);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> listForDeal(Long dealId) {
        Deal deal = mustLoadDealForRead(dealId);
        return documents.findAllByDealIdAndStatusOrderByCreatedAtDesc(deal.getId(), DocumentStatus.ACTIVE)
                .stream().map(this::toDto).toList();
    }

    /**
     * Everything filed against one node, and — for an individual — the ID scans of the person
     * behind it.
     *
     * <p>The two sets exist for different reasons and are joined here rather than at either
     * source. Node documents are what a reviewer attached while working on this node; the
     * person's scans are what the broker photographed, and they are linked to the <em>person</em>
     * so they follow them across deals. Showing only the first left the tab empty on every
     * extraction-created individual, which is most of them.
     */
    @Transactional(readOnly = true)
    public List<DocumentDto> listForNode(Long nodeId) {
        OwnershipNode node = ownershipNodes.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Ownership node " + nodeId + " not found"));
        OwnershipStructure structure = ownershipStructures.findById(node.getOwnershipStructureId())
                .orElseThrow(() -> new NotFoundException("Ownership structure not found"));
        // Reuse the deal-level read permission check so firm-user / broker scoping is honoured.
        mustLoadDealForRead(structure.getDealId());

        List<Document> found = new java.util.ArrayList<>(
                documents.findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(node.getId(), DocumentStatus.ACTIVE));

        if (node.getBeneficialOwnerId() != null) {
            java.util.Set<Long> seen = found.stream().map(Document::getId)
                    .collect(java.util.stream.Collectors.toCollection(java.util.HashSet::new));
            // A document can legitimately be on both — the dedupe is on identity, not position.
            documents.findAllByBeneficialOwnerIdAndStatus(node.getBeneficialOwnerId(), DocumentStatus.ACTIVE)
                    .stream().filter(d -> seen.add(d.getId())).forEach(found::add);
            found.sort(java.util.Comparator.comparing(Document::getCreatedAt).reversed());
        }

        return found.stream().map(this::toDto).toList();
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

    /**
     * Deletes a document.
     *
     * <p>Open to ROOT and SENIOR_MANAGER for any document, and to the <em>uploader</em> for their
     * own. That second case is not a loosening for its own sake: the deal form's own remove
     * buttons (IdScanList, ValuationField) call this endpoint as the broker, so without it an
     * agent could not clear a mis-scanned ID they had just taken.
     */
    @Transactional
    public void delete(Long id) {
        Document d = documents.findById(id)
                .orElseThrow(() -> new NotFoundException("Document " + id + " not found"));
        assertMayChange(d);
        if (d.getStatus() == DocumentStatus.DELETED) return;

        // The row goes DELETED either way, so the document leaves the live deal either way — that
        // is what listForDeal filters on and it is unaffected by any of this.
        //
        // The bytes are a different question. A verified deal keeps a copy of the documents it was
        // signed off with (deal_version_document), and those rows name this same S3 object: keys
        // carry a UUID, so an object is written once and never overwritten, and nothing is gained
        // by duplicating it per version. Deleting it here would leave every past version listing
        // evidence it could no longer produce — the sign-off would still claim the passport was
        // checked and no longer be able to show it. So the object stays for as long as a version
        // refers to it, and only an unreferenced one is really removed.
        if (!versionDocuments.existsBySourceDocumentId(d.getId())) {
            storage.delete(d.getS3Key());
        }
        d.setStatus(DocumentStatus.DELETED);
        audit.record(AuditAction.DOCUMENT_DELETED, "Document", d.getId(),
                "Deleted " + d.getOriginalFilename());

        // Evidence the verification rested on is gone, so the verification goes with it.
        verificationReset.clearForDocument(d, "document removed");

        // The person goes only with their last remaining image — removing one side of a card
        // leaves someone who was still presented, evidenced by the other side.
        beneficialOwners.removeIfOrphaned(d.getDealId(), d.getBeneficialOwnerId());
    }

    /**
     * Moves a document between owners and the property (the deal's own documents) on one deal:
     * owner to owner, owner to property, property to owner. One to one: the row changes place, it
     * is not copied. {@code targetNodeId} null means the property.
     *
     * <p>An ID scan hangs off the person record the deal form created rather than off a node or
     * the deal, and does not move; the drawer will not delete one either.
     *
     * <p>Both owners' verifications are withdrawn if they have one: one has lost evidence the
     * decision rested on, the other has gained evidence it never saw. The S3 key stays as it is —
     * it is only where the bytes live, and past versions name the object by it.
     */
    @Transactional
    public DocumentDto move(Long id, Long targetNodeId) {
        return move(id, targetNodeId, null, null);
    }

    /**
     * A move that may also refile the document as another type and rename it. The target's rules
     * are checked against the new type, so a passport reaches the property only as something the
     * property takes. Null keeps the current type or name. Audio stays audio and a file stays a
     * file: the player and the viewer pick their path by type.
     */
    @Transactional
    public DocumentDto move(Long id, Long targetNodeId, DocumentType newType, String newFilename) {
        Document d = documents.findById(id)
                .orElseThrow(() -> new NotFoundException("Document " + id + " not found"));
        if (d.getStatus() != DocumentStatus.ACTIVE) {
            throw new BadRequestException("Only an uploaded, live document can be moved");
        }
        assertMayChange(d);

        boolean onOwner = d.getOwnershipNodeId() != null;
        boolean onProperty = !onOwner && d.getBeneficialOwnerId() == null;
        if (!onOwner && !onProperty) {
            // An ID scan hanging off the person the deal form created.
            throw new BadRequestException(
                    "This is an ID scan from the deal form, filed on the person. Move it there.");
        }

        OwnershipNode source = onOwner ? ownershipNodes.findById(d.getOwnershipNodeId()).orElse(null) : null;
        String from = onOwner
                ? (source == null ? "#" + d.getOwnershipNodeId() : "\"" + source.getDisplayName() + "\"")
                : "the property";

        DocumentType oldType = d.getDocumentType();
        DocumentType type = newType != null ? newType : oldType;
        if (type.isAudio() != oldType.isAudio()) {
            throw new BadRequestException(oldType.isAudio()
                    ? "A voice note can only be filed as a voice note"
                    : "Only a recording can be filed as a voice note");
        }
        String oldName = d.getOriginalFilename();
        String name = renamed(oldName, newFilename);

        OwnershipNode target = null;
        if (targetNodeId == null) {
            if (onProperty) throw new BadRequestException("The document is already on the property");
            if (!DEAL_LEVEL_TYPES.contains(type)) {
                throw new BadRequestException("The property does not take "
                        + type.name().replace('_', ' ').toLowerCase()
                        + " documents; file it on an owner");
            }
        } else {
            if (targetNodeId.equals(d.getOwnershipNodeId())) {
                throw new BadRequestException("The document is already filed on that owner");
            }
            target = ownershipNodes.findById(targetNodeId)
                    .orElseThrow(() -> new BadRequestException("Ownership node " + targetNodeId + " not found"));
            OwnershipStructure structure = ownershipStructures.findById(target.getOwnershipStructureId())
                    .orElseThrow(() -> new BadRequestException("Ownership structure not found"));
            if (d.getDealId() == null || !d.getDealId().equals(structure.getDealId())) {
                throw new BadRequestException("A document can only move to an owner on the same deal");
            }
            assertAccepts(target, type);
        }

        d.setOwnershipNodeId(target == null ? null : target.getId());
        d.setDocumentType(type);
        d.setOriginalFilename(name);

        java.util.List<String> changes = new java.util.ArrayList<>();
        if (type != oldType) changes.add("type " + oldType.name() + " \u2192 " + type.name());
        if (!name.equals(oldName)) changes.add("renamed to " + name);
        audit.record(AuditAction.DOCUMENT_MOVED, "Document", d.getId(),
                "Moved " + oldName + " from " + from + " to "
                        + (target == null ? "the property" : "\"" + target.getDisplayName() + "\"")
                        + (changes.isEmpty() ? "" : " (" + String.join("; ", changes) + ")"));
        // Only owners carry a verification; the property has none to withdraw.
        if (source != null) verificationReset.clearIfVerified(source, "document moved away");
        if (target != null) verificationReset.clearIfVerified(target, "document added");
        return toDto(d);
    }

    /**
     * What the property — the deal's own documents — may hold. Mirrors the frontend's
     * DEAL_DOCUMENT_TYPES, which narrows its upload picker; enforced here only on a move, so an
     * owner's passport cannot be parked on the deal with nobody behind it.
     */
    private static final java.util.Set<DocumentType> DEAL_LEVEL_TYPES = java.util.EnumSet.of(
            DocumentType.TITLE_DOC, DocumentType.SALE_AGREEMENT, DocumentType.OWNERSHIP_STRUCTURE,
            DocumentType.VALUATION_MIN_EVIDENCE, DocumentType.VALUATION_MAX_EVIDENCE,
            DocumentType.PROOF_OF_ADDRESS, DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.WEB_SEARCH_RESULT, DocumentType.OTHER);

    /* ---------- helpers ---------- */

    /**
     * Who may delete or move a document: its uploader, or a firm-level reviewer or ROOT for
     * anyone's. Still status-checked for everyone firm-scoped.
     */
    private void assertMayChange(Document d) {
        UserPrincipal actor = currentPrincipal();
        // A firm-level reviewer may remove a document somebody else uploaded — they are the
        // ones working through the file. ROOT joins them because it manages the platform.
        boolean elevated = actor.role() == Role.ROOT || actor.role().isFirmLevel();
        if (!elevated && !actor.id().equals(d.getUploadedByUserId())) {
            throw new ForbiddenException(
                    "Only the uploader, a compliance officer, a senior manager or ROOT may change this document");
        }
        // ROOT included: the exemption below is from the firm check, not from the branch's hold.
        if (actor.role() == Role.ROOT && d.getDealId() != null) {
            deals.findById(d.getDealId()).ifPresent(lifecycle::assertBranchWritable);
        }
        // Still status-checked for everyone firm-scoped: assertEditable is the codebase's
        // answer to "may this actor write to this deal", and it now admits reviewers through
        // REVIEW and ON_HOLD. ROOT skips it because it belongs to no firm, so the
        // firm check inside could never pass — that is the reason for the exemption, not rank.
        //
        // Anyone else here is the uploader, and answers to the upload rule rather than the edit
        // rule: a branch admin or sales manager who may add a document in REVIEW must be able to
        // take back their own mistake in REVIEW too.
        if (actor.role() != Role.ROOT && d.getDealId() != null) {
            Deal deal = deals.findById(d.getDealId())
                    .orElseThrow(() -> new NotFoundException("Deal " + d.getDealId() + " not found"));
            Long firmId = branches.findById(deal.getFirmBranchId())
                    .map(FirmBranch::getRealEstateFirmId).orElse(null);
            if (actor.role().isFirmLevel()) {
                lifecycle.assertEditable(deal, actor, firmId);
            } else {
                lifecycle.assertCanUploadDocuments(deal, actor, firmId);
            }
        }
    }

    /**
     * The name a move leaves a document with. Blank keeps the old one; a name typed without the
     * old extension gets it back, since the download and the viewer go by it; path separators
     * become underscores.
     */
    static String renamed(String oldName, String newName) {
        if (newName == null) return oldName;
        String name = newName.replaceAll("[\\\\/]", "_").trim();
        if (name.isEmpty()) return oldName;
        int dot = oldName == null ? -1 : oldName.lastIndexOf('.');
        String ext = dot > 0 ? oldName.substring(dot) : "";
        if (!ext.isEmpty() && !name.toLowerCase().endsWith(ext.toLowerCase())) name += ext;
        return name.length() > 255 ? name.substring(0, 255) : name;
    }

    /** The upload rule, shared with a move: a node only holds the document types its type accepts. */
    private static void assertAccepts(OwnershipNode node, DocumentType type) {
        if (!node.getNodeType().accepts(type)) {
            throw new BadRequestException(
                    "A " + node.getNodeType().name().replace('_', ' ').toLowerCase()
                            + " does not accept " + type.name().replace('_', ' ').toLowerCase()
                            + " documents");
        }
    }

    private Deal mustLoadDealForWrite(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new BadRequestException("Deal " + dealId + " not found"));
        // A real write gate: read scope plus the deal's status (see canUploadDocuments). It used to
        // be read scope alone, which let anyone who could open a deal add documents, and the
        // provisional owners a scan creates, to a VERIFIED or CLOSED one (C-07).
        Long firmId = branches.findById(deal.getFirmBranchId())
                .map(FirmBranch::getRealEstateFirmId).orElse(null);
        lifecycle.assertCanUploadDocuments(deal, currentPrincipal(), firmId);
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
        User uploader = d.getUploadedByUserId() == null ? null : users.findById(d.getUploadedByUserId()).orElse(null);
        return DocumentDto.from(d, uploader);
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

    /** Roles that may manage documents beyond their own uploads (confirm on behalf of another). */
    private static boolean canManageDocuments(Role role) {
        return role == Role.ROOT
                || role == Role.AML_COMPLIANCE_OFFICER
                || role == Role.SENIOR_MANAGER
                || role == Role.SALES_MANAGER
                || role == Role.ADMIN;
    }
}
