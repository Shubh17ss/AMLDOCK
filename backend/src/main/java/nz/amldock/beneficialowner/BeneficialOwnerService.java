package nz.amldock.beneficialowner;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import nz.amldock.beneficialowner.dto.BeneficialOwnerDto;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.ocr.ExtractedField;
import nz.amldock.document.ocr.ExtractedIdFields;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.OwnershipService;
import nz.amldock.user.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * The people identified from a deal's scanned IDs.
 *
 * <p><strong>One identity document, one person.</strong> An owner is created the moment the first
 * image of a card is confirmed — before anything has been read — and is never merged into another.
 * Front and back of one card share an owner because they are one document; anything else is a
 * different person, whatever the extracted names happen to say.
 *
 * <p>That last part is deliberate and replaces the name + date-of-birth matching this class used
 * to do. Deciding that two documents describe one human is a judgement, not an extraction result,
 * and getting it wrong silently fuses two people in an AML record.
 */
@Service
public class BeneficialOwnerService {

    private static final Logger log = LoggerFactory.getLogger(BeneficialOwnerService.class);

    private final BeneficialOwnerRepository owners;
    private final DealBeneficialOwnerRepository links;
    private final DealRepository deals;
    private final DocumentRepository documents;
    private final FirmBranchRepository branches;
    private final OwnershipService ownership;
    private final DealLifecycleService lifecycle;
    private final ObjectMapper json;

    public BeneficialOwnerService(BeneficialOwnerRepository owners,
                                  DealBeneficialOwnerRepository links,
                                  DealRepository deals,
                                  DocumentRepository documents,
                                  FirmBranchRepository branches,
                                  OwnershipService ownership,
                                  DealLifecycleService lifecycle,
                                  ObjectMapper json) {
        this.owners = owners;
        this.links = links;
        this.deals = deals;
        this.documents = documents;
        this.branches = branches;
        this.ownership = ownership;
        this.lifecycle = lifecycle;
        this.json = json;
    }

    /* ---------- creation, at upload time ---------- */

    /**
     * Creates the person a newly confirmed identity scan belongs to, with nothing filled in yet.
     *
     * <p>Called from {@code DocumentService.confirmUpload} rather than from extraction, so a
     * broker who scans an ID sees an individual appear immediately — including when Textract
     * later fails to read it. An unreadable scan is still evidence that someone was presented.
     *
     * <p>No permission check: the caller has already passed {@code mustLoadDealForWrite}.
     */
    @Transactional
    public BeneficialOwner createProvisional(Document doc) {
        Long dealId = doc.getDealId();

        BeneficialOwner owner = new BeneficialOwner();
        owner.setRealEstateFirmId(firmIdForDeal(dealId));
        owner.setReviewStatus(ReviewStatus.UNREVIEWED);
        owner = owners.save(owner);

        links.save(new DealBeneficialOwner(dealId, owner.getId(), doc.getId()));

        ownership.attachExtractedIndividual(
                dealId, owner.getId(), displayNameFor(owner, doc), null, doc.getDocumentType().name());

        log.debug("Created provisional beneficial owner {} for document {}", owner.getId(), doc.getId());
        return owner;
    }

    /* ---------- extraction results ---------- */

    /**
     * Folds what was read off one image into the person it belongs to.
     *
     * <p>The person is always {@code doc.beneficialOwnerId}, fixed when the image was uploaded.
     * Extraction never chooses who a document belongs to, so a misread name cannot move evidence
     * onto the wrong individual.
     *
     * <p>Front and back are extracted independently and land in either order, so neither may
     * assume it went first — hence fill-or-improve rather than overwrite. A licence back usually
     * reads nothing and correctly leaves the person untouched.
     */
    @Transactional
    public void applyExtraction(Document doc, ExtractedIdFields fields) {
        if (doc.getBeneficialOwnerId() == null) return;      // not an identity scan
        BeneficialOwner owner = owners.findById(doc.getBeneficialOwnerId()).orElse(null);
        if (owner == null) return;                            // scan deleted mid-extraction

        ObjectNode confidence = parseConfidence(owner.getExtractionConfidence());

        if (shouldWrite(owner.getFullName(), storedConfidence(confidence, "fullName"), fields.fullName())) {
            owner.setFullName(normaliseName(fields.fullName().value()));
            putConfidence(confidence, "fullName", fields.fullName());
        }
        if (shouldWrite(owner.getDateOfBirth(), storedConfidence(confidence, "dateOfBirth"), fields.dateOfBirth())) {
            owner.setDateOfBirth(fields.dateOfBirth().value());
            putConfidence(confidence, "dateOfBirth", fields.dateOfBirth());
        }
        if (shouldWrite(owner.getIdExpiryDate(), storedConfidence(confidence, "expiryDate"), fields.expiryDate())) {
            owner.setIdExpiryDate(fields.expiryDate().value());
            putConfidence(confidence, "expiryDate", fields.expiryDate());
        }

        owner.setExtractionConfidence(confidence.toString());

        ownership.refreshExtractedIndividual(
                owner.getId(), displayNameFor(owner, doc), owner.getDateOfBirth());
    }

    /**
     * Whether an incoming reading should displace what is already recorded.
     *
     * <p>Fills a gap unconditionally, and otherwise replaces only on a <em>strictly</em> higher
     * confidence. A reading whose confidence is unknown never displaces a value that has one —
     * without a number to compare, "different" is not evidence of "better".
     */
    static boolean shouldWrite(Object current, BigDecimal stored, ExtractedField<?> incoming) {
        if (!incoming.isPresent()) return false;
        if (current == null) return true;
        BigDecimal in = incoming.confidence();
        if (in == null) return false;
        if (stored == null) return true;
        return in.compareTo(stored) > 0;
    }

    /* ---------- removal ---------- */

    /**
     * Removes a person once their last remaining scan has gone.
     *
     * <p>Deleting one side of a two-sided card leaves the person in place with an empty slot —
     * they were still presented, and the other image still evidences them.
     */
    @Transactional
    public void removeIfOrphaned(Long beneficialOwnerId) {
        if (beneficialOwnerId == null) return;
        if (!documents.findAllByBeneficialOwnerIdAndStatus(beneficialOwnerId, DocumentStatus.ACTIVE).isEmpty()) {
            return;
        }
        ownership.removeExtractedIndividual(beneficialOwnerId);
        links.deleteAllByBeneficialOwnerId(beneficialOwnerId);
        owners.deleteById(beneficialOwnerId);
        log.debug("Removed beneficial owner {} — last identity scan deleted", beneficialOwnerId);
    }

    /**
     * Detaches every person from a deal that is being deleted, and removes any who are left on no
     * deal at all.
     *
     * <p>Must run <em>before</em> the deal row goes: {@code deal_beneficial_owner} cascades with
     * it, and once those rows are gone there is no way to tell which people the deal held.
     *
     * <p>A person on other deals is kept. That is the whole point of the join table — the same
     * human can appear across a firm's deals, and deleting one of them is not a statement about
     * the others. Only someone left with no deal is genuinely unreferenced, and keeping those
     * would accumulate identity records nothing can reach or review.
     *
     * <p>No permission check: the caller is {@code DealService.delete}, which has already run
     * {@code assertCanDelete}.
     */
    @Transactional
    public void releaseFromDeal(Long dealId) {
        List<Long> ownerIds = links.findAllByDealIdOrderByCreatedAtAsc(dealId).stream()
                .map(DealBeneficialOwner::getBeneficialOwnerId)
                .toList();
        if (ownerIds.isEmpty()) return;

        links.deleteAllByDealId(dealId);
        // The counts below must not see the rows just removed, and Spring Data's derived delete
        // does not flush on its own.
        links.flush();

        for (Long ownerId : ownerIds) {
            if (links.countByBeneficialOwnerId(ownerId) == 0) {
                // ownership_node.beneficial_owner_id is ON DELETE SET NULL, so a node on some
                // other structure that still points here is blanked rather than destroyed.
                owners.deleteById(ownerId);
                log.debug("Removed beneficial owner {} — no longer on any deal", ownerId);
            }
        }
    }

    /* ---------- reads ---------- */

    @Transactional(readOnly = true)
    public List<BeneficialOwnerDto> listForDeal(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        lifecycle.assertCanRead(deal, currentPrincipal(), firmIdForDeal(dealId));

        return links.findAllByDealIdOrderByCreatedAtAsc(dealId).stream()
                .map(link -> owners.findById(link.getBeneficialOwnerId()).orElse(null))
                .filter(Objects::nonNull)
                .map(this::toDto)
                .toList();
    }

    private BeneficialOwnerDto toDto(BeneficialOwner owner) {
        List<Document> scans =
                documents.findAllByBeneficialOwnerIdAndStatus(owner.getId(), DocumentStatus.ACTIVE);
        String type = scans.stream().findFirst().map(d -> d.getDocumentType().name()).orElse(null);
        return BeneficialOwnerDto.from(owner, type, scans.size());
    }

    /* ---------- helpers ---------- */

    /** Collapses whitespace and trims. Case is preserved — this is a name, shown as read. */
    static String normaliseName(String raw) {
        if (raw == null) return null;
        String n = raw.replaceAll("\\s+", " ").trim();
        return n.isEmpty() ? null : n;
    }

    /**
     * {@code ownership_node.display_name} is NOT NULL, so a scan that yielded no name still needs
     * one. Naming it after the file it came from keeps the node traceable to its evidence, which
     * a placeholder like "Unknown" would not.
     */
    static String displayNameFor(BeneficialOwner owner, Document doc) {
        if (owner.getFullName() != null) return owner.getFullName();
        return "Unread ID - " + doc.getOriginalFilename();
    }

    private ObjectNode parseConfidence(String raw) {
        if (raw != null && !raw.isBlank()) {
            try {
                JsonNode parsed = json.readTree(raw);
                if (parsed instanceof ObjectNode node) return node;
            } catch (Exception e) {
                // A malformed blob must not stall extraction; start a fresh one.
                log.warn("Unreadable extraction_confidence, replacing: {}", e.toString());
            }
        }
        return json.createObjectNode();
    }

    private static BigDecimal storedConfidence(ObjectNode node, String key) {
        JsonNode v = node.get(key);
        return v == null || v.isNull() ? null : v.decimalValue();
    }

    private static void putConfidence(ObjectNode node, String key, ExtractedField<?> field) {
        BigDecimal c = field.confidence();
        if (c == null) node.putNull(key);
        else node.put(key, c);
    }

    private Long firmIdForDeal(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        return branches.findById(deal.getFirmBranchId())
                .map(FirmBranch::getRealEstateFirmId)
                .orElseThrow(() -> new NotFoundException("Branch for deal " + dealId + " not found"));
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new NotFoundException("No authenticated user");
    }
}
