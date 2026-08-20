package nz.amldock.beneficialowner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import nz.amldock.beneficialowner.dto.BeneficialOwnerDto;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.document.Document;
import nz.amldock.document.ocr.ExtractedField;
import nz.amldock.document.ocr.ExtractedIdFields;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.OwnershipNode;
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
import java.util.Optional;

/**
 * Turns an extracted identity document into a person on the deal.
 *
 * <p>Runs inside the extraction worker's completion transaction, so a document can never reach
 * DONE without its person records existing.
 */
@Service
public class BeneficialOwnerService {

    private static final Logger log = LoggerFactory.getLogger(BeneficialOwnerService.class);

    private final BeneficialOwnerRepository owners;
    private final DealBeneficialOwnerRepository links;
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final OwnershipService ownership;
    private final DealLifecycleService lifecycle;
    private final ObjectMapper json;

    public BeneficialOwnerService(BeneficialOwnerRepository owners,
                                  DealBeneficialOwnerRepository links,
                                  DealRepository deals,
                                  FirmBranchRepository branches,
                                  OwnershipService ownership,
                                  DealLifecycleService lifecycle,
                                  ObjectMapper json) {
        this.owners = owners;
        this.links = links;
        this.deals = deals;
        this.branches = branches;
        this.ownership = ownership;
        this.lifecycle = lifecycle;
        this.json = json;
    }

    /**
     * Records the person on {@code doc} against its deal, creating the ownership node too.
     *
     * <p>No permission check — see {@link OwnershipService#attachExtractedIndividual}. The caller
     * is the OCR worker, which runs on a scheduler thread with no SecurityContext.
     *
     * @return the person, existing or new
     */
    @Transactional
    public BeneficialOwner recordFromExtraction(Document doc, ExtractedIdFields fields) {
        Long dealId = doc.getDealId();
        Long firmId = firmIdForDeal(dealId);

        String name = normaliseName(fields.fullName().value());

        Optional<BeneficialOwner> existing = findWithinDeal(dealId, name, fields);
        if (existing.isPresent()) {
            BeneficialOwner owner = existing.get();
            // A second scan of the same person - a passport after a licence, say - is new
            // evidence, not a new human. Fill gaps rather than creating a duplicate.
            mergeInto(owner, fields);
            log.debug("Matched extraction from document {} to existing beneficial owner {}",
                    doc.getId(), owner.getId());
            return owner;
        }

        BeneficialOwner owner = new BeneficialOwner();
        owner.setRealEstateFirmId(firmId);
        owner.setFullName(name);
        owner.setDateOfBirth(fields.dateOfBirth().value());
        owner.setIdExpiryDate(fields.expiryDate().value());
        owner.setExtractionConfidence(confidenceJson(fields));
        owner.setReviewStatus(ReviewStatus.UNREVIEWED);
        owner = owners.save(owner);

        links.save(new DealBeneficialOwner(dealId, owner.getId(), doc.getId()));

        OwnershipNode node = ownership.attachExtractedIndividual(
                dealId,
                owner.getId(),
                displayNameFor(owner, doc),
                owner.getDateOfBirth(),
                doc.getDocumentType().name());

        log.debug("Created beneficial owner {} and ownership node {} from document {}",
                owner.getId(), node.getId(), doc.getId());
        return owner;
    }

    @Transactional(readOnly = true)
    public List<BeneficialOwnerDto> listForDeal(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        lifecycle.assertCanRead(deal, currentPrincipal(), firmIdForDeal(dealId));

        return links.findAllByDealIdOrderByCreatedAtAsc(dealId).stream()
                .map(link -> owners.findById(link.getBeneficialOwnerId())
                        .map(o -> BeneficialOwnerDto.from(o, link.getSourceDocumentId()))
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
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

    /* ---------- matching ---------- */

    /**
     * Looks for the same person already on this deal.
     *
     * <p><strong>Within the deal only, and only on an exact name plus date-of-birth match.</strong>
     * Both must be present: a null identifies nobody, so two unreadable scans must not collapse
     * into one person.
     *
     * <p>Matching is deliberately not attempted across deals. The schema supports one person on
     * many deals, but OCR mangles names, and a wrong link between two deals is a false statement
     * in an AML record - hard to notice and harder to unpick. Promoting a match across deals
     * should be something a human does.
     */
    private Optional<BeneficialOwner> findWithinDeal(Long dealId, String name, ExtractedIdFields fields) {
        if (name == null || fields.dateOfBirth().value() == null) return Optional.empty();

        // A deal carries a handful of people, so this is a small list and the comparison can be
        // done in Java, where it uses the same normalisation that wrote the value.
        return links.findAllByDealIdOrderByCreatedAtAsc(dealId).stream()
                .map(l -> owners.findById(l.getBeneficialOwnerId()).orElse(null))
                .filter(Objects::nonNull)
                .filter(o -> fields.dateOfBirth().value().equals(o.getDateOfBirth()))
                .filter(o -> name.equalsIgnoreCase(normaliseName(o.getFullName())))
                .findFirst();
    }

    /** Fills only what is currently missing; an existing value is never overwritten by a rescan. */
    private void mergeInto(BeneficialOwner owner, ExtractedIdFields fields) {
        if (owner.getFullName() == null) owner.setFullName(normaliseName(fields.fullName().value()));
        if (owner.getDateOfBirth() == null) owner.setDateOfBirth(fields.dateOfBirth().value());
        if (owner.getIdExpiryDate() == null) owner.setIdExpiryDate(fields.expiryDate().value());
    }

    /** Collapses whitespace and trims. Case is preserved for display; matching is case-insensitive. */
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

    private String confidenceJson(ExtractedIdFields fields) {
        ObjectNode node = json.createObjectNode();
        putConfidence(node, "fullName", fields.fullName());
        putConfidence(node, "dateOfBirth", fields.dateOfBirth());
        putConfidence(node, "expiryDate", fields.expiryDate());
        return node.toString();
    }

    private static void putConfidence(ObjectNode node, String key, ExtractedField<?> field) {
        BigDecimal c = field.confidence();
        if (field.isPresent() && c != null) node.put(key, c);
        else node.putNull(key);
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
