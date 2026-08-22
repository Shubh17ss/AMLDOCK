package nz.amldock.ownership;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.beneficialowner.DealBeneficialOwner;
import nz.amldock.beneficialowner.DealBeneficialOwnerRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.dto.CreateEdgeRequest;
import nz.amldock.ownership.dto.CreateNodeRequest;
import nz.amldock.ownership.dto.EdgeDto;
import nz.amldock.ownership.dto.NodeDto;
import nz.amldock.ownership.dto.PersonDto;
import nz.amldock.ownership.dto.PersonPatch;
import nz.amldock.ownership.dto.TreeDto;
import nz.amldock.ownership.dto.UpdateEdgeRequest;
import nz.amldock.ownership.dto.UpdateNodeRequest;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class OwnershipService {

    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final OwnershipEdgeRepository edges;
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final DealLifecycleService lifecycle;
    // The repositories rather than BeneficialOwnerService: that service already depends on this
    // one (extraction creates nodes through it), and a constructor cycle fails at startup.
    private final BeneficialOwnerRepository owners;
    private final DealBeneficialOwnerRepository ownerLinks;

    public OwnershipService(OwnershipStructureRepository structures,
                            OwnershipNodeRepository nodes,
                            OwnershipEdgeRepository edges,
                            DealRepository deals,
                            FirmBranchRepository branches,
                            DealLifecycleService lifecycle,
                            BeneficialOwnerRepository owners,
                            DealBeneficialOwnerRepository ownerLinks) {
        this.structures = structures;
        this.nodes = nodes;
        this.edges = edges;
        this.deals = deals;
        this.branches = branches;
        this.lifecycle = lifecycle;
        this.owners = owners;
        this.ownerLinks = ownerLinks;
    }

    /* ---------- queries ---------- */

    @Transactional
    public TreeDto getTree(Long dealId) {
        Deal deal = assertReadable(dealId);
        OwnershipStructure structure = structures.findByDealId(deal.getId())
                .orElseGet(() -> createEmptyStructure(deal.getId()));
        return loadTree(structure);
    }

    @Transactional(readOnly = true)
    public TreeDto previewTree(Long dealId) {
        Deal deal = assertReadable(dealId);
        OwnershipStructure structure = structures.findByDealId(deal.getId()).orElse(null);
        if (structure == null) {
            return new TreeDto(null, deal.getId(), null, null, List.of(), List.of());
        }
        return loadTree(structure);
    }

    /* ---------- node CRUD ---------- */

    @Transactional
    public NodeDto createNode(Long dealId, CreateNodeRequest req) {
        Deal deal = assertReadable(dealId);
        OwnershipStructure structure = structures.findByDealId(deal.getId())
                .orElseGet(() -> createEmptyStructure(deal.getId()));

        OwnershipNode n = new OwnershipNode();
        n.setOwnershipStructureId(structure.getId());
        n.setNodeType(req.nodeType());
        n.setDisplayName(req.displayName());
        n.setPersonRole(req.personRole());
        n.setReference(req.reference());
        n.setNotes(req.notes());
        applyNodeFields(n, req.dateOfBirth(), req.idDocumentType(), req.idDocumentNumber(), req.idDocumentCountry(),
                req.nzbn(), req.companyNumber(), req.incorporationDate(), req.registeredOffice(),
                req.trustName(), req.trustDeedDocumentId(), req.settlorName(), req.extraJson());

        // Every individual has a person record, whether they arrived through a scanned ID or by
        // hand: the shared contact and background fields live there, so a node without one has
        // nowhere to put an email address and the form would silently discard it.
        BeneficialOwner person = null;
        if (req.nodeType() == NodeType.INDIVIDUAL) {
            person = createPersonFor(deal, req.displayName());
            n.setBeneficialOwnerId(person.getId());
            applyPersonPatch(person, req.person());
        }

        return NodeDto.from(nodes.save(n), person == null ? null : PersonDto.from(person));
    }

    @Transactional
    public NodeDto updateNode(Long dealId, Long nodeId, UpdateNodeRequest req) {
        Deal deal = assertReadable(dealId);
        OwnershipNode n = mustLoadNodeForDeal(deal, nodeId);
        if (req.nodeType() != null) {
            assertRetypeAllowed(n, req.nodeType());
            n.setNodeType(req.nodeType());
        }
        if (req.displayName() != null && !req.displayName().isBlank()) n.setDisplayName(req.displayName());
        if (req.dateOfBirth() != null) n.setDateOfBirth(req.dateOfBirth());
        if (req.idDocumentType() != null) n.setIdDocumentType(req.idDocumentType());
        if (req.idDocumentNumber() != null) n.setIdDocumentNumber(req.idDocumentNumber());
        if (req.idDocumentCountry() != null) n.setIdDocumentCountry(req.idDocumentCountry());
        if (req.nzbn() != null) n.setNzbn(req.nzbn());
        if (req.companyNumber() != null) n.setCompanyNumber(req.companyNumber());
        if (req.incorporationDate() != null) n.setIncorporationDate(req.incorporationDate());
        if (req.registeredOffice() != null) n.setRegisteredOffice(req.registeredOffice());
        if (req.trustName() != null) n.setTrustName(req.trustName());
        if (req.trustDeedDocumentId() != null) n.setTrustDeedDocumentId(req.trustDeedDocumentId());
        if (req.settlorName() != null) n.setSettlorName(req.settlorName());
        if (req.extraJson() != null) n.setExtraJson(req.extraJson());
        if (req.personRole() != null) n.setPersonRole(req.personRole());
        if (req.reference() != null) n.setReference(req.reference());
        if (req.verificationStatus() != null) n.setVerificationStatus(req.verificationStatus());
        if (req.notes() != null) n.setNotes(req.notes());
        if (req.verificationNotes() != null) n.setVerificationNotes(req.verificationNotes());

        BeneficialOwner person = personFor(n);
        if (req.person() != null && person != null) {
            // This write leaves the deal. The check is the person's own firm against this deal's,
            // deliberately not inherited from the deal-scoped URL the request arrived on.
            assertSameFirm(person, deal);
            applyPersonPatch(person, req.person());
            // display_name is NOT NULL and is what the tree renders, so it follows the name.
            if (person.getFullName() != null && !person.getFullName().isBlank()) {
                n.setDisplayName(person.getFullName());
            }
        }
        return NodeDto.from(n, person == null ? null : PersonDto.from(person));
    }

    @Transactional
    public void deleteNode(Long dealId, Long nodeId, boolean force) {
        Deal deal = assertReadable(dealId);
        OwnershipNode n = mustLoadNodeForDeal(deal, nodeId);

        List<OwnershipEdge> outgoing = edges.findAllByParentNodeId(n.getId());
        List<OwnershipEdge> incoming = edges.findAllByChildNodeId(n.getId());
        if (!force && (!outgoing.isEmpty() || !incoming.isEmpty())) {
            throw new BadRequestException(
                    "Node has " + outgoing.size() + " outgoing and " + incoming.size() +
                            " incoming edges. Pass ?force=true to cascade.");
        }
        edges.deleteAll(outgoing);
        edges.deleteAll(incoming);

        // Clear root reference if needed
        OwnershipStructure structure = structures.findById(n.getOwnershipStructureId()).orElse(null);
        if (structure != null && n.getId().equals(structure.getRootNodeId())) {
            structure.setRootNodeId(null);
        }

        Long personId = n.getBeneficialOwnerId();
        nodes.delete(n);
        if (personId != null) removePersonIfHandAdded(deal, personId);
    }

    /**
     * Removes the person behind a deleted node when nobody ever scanned an ID for them.
     *
     * <p>A hand-added individual exists only as that node, so leaving the person behind would
     * leave a name on the deal's people list that no longer appears anywhere in the structure.
     *
     * <p>A person who came from a scan is left alone: their evidence is still in the deal, and
     * removing them is {@code BeneficialOwnerService.removeIfOrphaned}'s job when the last image
     * of their card goes. The source document on the link is what tells the two apart.
     */
    private void removePersonIfHandAdded(Deal deal, Long personId) {
        DealBeneficialOwner link = ownerLinks.findAllByDealIdOrderByCreatedAtAsc(deal.getId()).stream()
                .filter(l -> l.getBeneficialOwnerId().equals(personId))
                .findFirst().orElse(null);
        if (link == null || link.getSourceDocumentId() != null) return;

        ownerLinks.delete(link);
        ownerLinks.flush();   // the count below must not see the row just removed
        if (ownerLinks.countByBeneficialOwnerId(personId) == 0) {
            owners.deleteById(personId);
        }
    }

    /* ---------- edge CRUD ---------- */

    @Transactional
    public EdgeDto createEdge(Long dealId, CreateEdgeRequest req) {
        Deal deal = assertReadable(dealId);
        if (req.parentNodeId().equals(req.childNodeId())) {
            throw new BadRequestException("A node cannot be its own parent");
        }
        OwnershipNode parent = mustLoadNodeForDeal(deal, req.parentNodeId());
        OwnershipNode child = mustLoadNodeForDeal(deal, req.childNodeId());
        if (!parent.getOwnershipStructureId().equals(child.getOwnershipStructureId())) {
            throw new BadRequestException("Parent and child belong to different ownership structures");
        }
        if (parent.getNodeType().isLeafOnly()) {
            throw new BadRequestException(
                    "An individual cannot own another node — " + parent.getDisplayName()
                            + " is always the bottom of a chain");
        }

        edges.findByParentNodeIdAndChildNodeId(parent.getId(), child.getId())
                .ifPresent(existing -> {
                    throw new BadRequestException("Edge already exists between these nodes");
                });

        // Cycle check: if we can reach `parent` starting from `child`, adding this edge would close a cycle.
        if (canReach(child.getId(), parent.getId())) {
            throw new BadRequestException("Adding this edge would create a cycle");
        }

        OwnershipEdge e = new OwnershipEdge();
        e.setParentNodeId(parent.getId());
        e.setChildNodeId(child.getId());
        e.setPercentage(normalisePercentage(req.percentage()));
        e.setRole(req.role());
        return EdgeDto.from(edges.save(e));
    }

    @Transactional
    public EdgeDto updateEdge(Long dealId, Long edgeId, UpdateEdgeRequest req) {
        Deal deal = assertReadable(dealId);
        OwnershipEdge edge = edges.findById(edgeId)
                .orElseThrow(() -> new NotFoundException("Edge " + edgeId + " not found"));
        // Sanity: the edge's nodes must belong to this deal's structure.
        OwnershipNode parent = mustLoadNodeForDeal(deal, edge.getParentNodeId());
        // parent load implicitly asserts structure linkage to this deal.
        if (req.percentage() != null) edge.setPercentage(normalisePercentage(req.percentage()));
        if (req.role() != null) edge.setRole(req.role());
        return EdgeDto.from(edge);
    }

    @Transactional
    public void deleteEdge(Long dealId, Long edgeId) {
        Deal deal = assertReadable(dealId);
        OwnershipEdge edge = edges.findById(edgeId)
                .orElseThrow(() -> new NotFoundException("Edge " + edgeId + " not found"));
        mustLoadNodeForDeal(deal, edge.getParentNodeId());
        edges.delete(edge);
    }

    /* ---------- root ---------- */

    @Transactional
    public TreeDto setRoot(Long dealId, Long nodeId) {
        Deal deal = assertReadable(dealId);
        OwnershipStructure structure = structures.findByDealId(deal.getId())
                .orElseGet(() -> createEmptyStructure(deal.getId()));
        if (nodeId == null) {
            structure.setRootNodeId(null);
        } else {
            OwnershipNode n = mustLoadNodeForDeal(deal, nodeId);
            structure.setRootNodeId(n.getId());
        }
        return loadTree(structure);
    }

    /* ---------- extraction-driven creation ---------- */

    /**
     * Creates the INDIVIDUAL node for a person read off a scanned ID.
     *
     * <p><strong>No permission check, deliberately.</strong> Every other entry point on this
     * service runs {@code assertReadable}, which reads the caller from the SecurityContext. The
     * OCR worker runs on a scheduler thread and has no SecurityContext, so that call would throw
     * rather than deny. Authorisation for this write already happened upstream: the broker had to
     * pass {@code mustLoadDealForWrite} to upload the document this person came from. Do not call
     * this from a controller.
     *
     * <p>The node is created as an <em>unattached leaf</em> — no ownership_edge rows. The entity
     * that actually owns the property (company, trust, partnership) is not established until the
     * compliance review, so there is no parent to attach to and inventing one would fabricate a
     * structure nobody asserted.
     */
    @Transactional
    public OwnershipNode attachExtractedIndividual(Long dealId,
                                                   Long beneficialOwnerId,
                                                   String displayName,
                                                   LocalDate dateOfBirth,
                                                   String idDocumentType) {
        OwnershipStructure structure = structures.findByDealId(dealId)
                .orElseGet(() -> createEmptyStructure(dealId));

        OwnershipNode n = new OwnershipNode();
        n.setOwnershipStructureId(structure.getId());
        n.setNodeType(NodeType.INDIVIDUAL);
        n.setDisplayName(displayName);
        n.setDateOfBirth(dateOfBirth);
        n.setIdDocumentType(idDocumentType);
        n.setBeneficialOwnerId(beneficialOwnerId);
        n.setVerificationStatus(NodeVerificationStatus.NOT_STARTED);
        return nodes.save(n);
    }

    /**
     * Updates the node standing for a person once extraction has read their card.
     *
     * <p>Same no-permission-check reasoning as {@link #attachExtractedIndividual}: the caller is
     * the OCR worker, on a scheduler thread with no SecurityContext.
     *
     * <p>A no-op when the node has since been removed — a broker can delete the scan while
     * extraction is still in flight.
     */
    @Transactional
    public void refreshExtractedIndividual(Long beneficialOwnerId, String displayName, LocalDate dateOfBirth) {
        nodes.findFirstByBeneficialOwnerId(beneficialOwnerId).ifPresent(n -> {
            if (displayName != null) n.setDisplayName(displayName);
            if (dateOfBirth != null) n.setDateOfBirth(dateOfBirth);
        });
    }

    /** Removes the node standing for a person. Used when their last scan is deleted. */
    @Transactional
    public void removeExtractedIndividual(Long beneficialOwnerId) {
        nodes.findFirstByBeneficialOwnerId(beneficialOwnerId).ifPresent(nodes::delete);
    }

    /* ---------- helpers ---------- */

    private OwnershipStructure createEmptyStructure(Long dealId) {
        OwnershipStructure s = new OwnershipStructure();
        s.setDealId(dealId);
        return structures.save(s);
    }

    private TreeDto loadTree(OwnershipStructure structure) {
        List<OwnershipNode> nodeList = nodes.findAllByOwnershipStructureIdOrderByIdAsc(structure.getId());
        List<Long> nodeIds = nodeList.stream().map(OwnershipNode::getId).toList();
        List<OwnershipEdge> edgeList = nodeIds.isEmpty()
                ? List.of()
                : edges.findAllByParentNodeIdIn(nodeIds);

        // One query for every person on the tree, rather than one per individual node.
        List<Long> ownerIds = nodeList.stream()
                .map(OwnershipNode::getBeneficialOwnerId)
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<Long, PersonDto> people = new HashMap<>();
        if (!ownerIds.isEmpty()) {
            owners.findAllById(ownerIds).forEach(o -> people.put(o.getId(), PersonDto.from(o)));
        }

        return new TreeDto(
                structure.getId(),
                structure.getDealId(),
                structure.getRootNodeId(),
                structure.getNotes(),
                nodeList.stream().map(n -> NodeDto.from(n, people.get(n.getBeneficialOwnerId()))).toList(),
                edgeList.stream().map(EdgeDto::from).toList());
    }

    /* ---------- the person behind an individual ---------- */

    /**
     * Creates the firm-scoped person record for a hand-added individual, and links them to the
     * deal so they appear alongside the people read off scanned IDs.
     *
     * <p>The mirror of {@code BeneficialOwnerService.createProvisional}, which does the same for
     * an individual arriving through an upload. Both paths end with one node, one person and one
     * deal link; only the trigger differs.
     */
    private BeneficialOwner createPersonFor(Deal deal, String displayName) {
        Long firmId = firmIdFor(deal);
        if (firmId == null) {
            throw new NotFoundException("Branch for deal " + deal.getId() + " not found");
        }
        BeneficialOwner person = new BeneficialOwner();
        person.setRealEstateFirmId(firmId);
        person.setFullName(displayName);
        person = owners.save(person);
        ownerLinks.save(new DealBeneficialOwner(deal.getId(), person.getId(), null));
        return person;
    }

    private BeneficialOwner personFor(OwnershipNode n) {
        return n.getBeneficialOwnerId() == null
                ? null
                : owners.findById(n.getBeneficialOwnerId()).orElse(null);
    }

    /** Only non-null fields are written; an empty string is a value and clears the field. */
    private static void applyPersonPatch(BeneficialOwner person, PersonPatch patch) {
        if (patch == null) return;
        if (patch.fullName() != null && !patch.fullName().isBlank()) person.setFullName(patch.fullName().trim());
        if (patch.email() != null) person.setEmail(emptyToNull(patch.email()));
        if (patch.phoneCountry() != null) person.setPhoneCountry(emptyToNull(patch.phoneCountry()));
        if (patch.phoneNumber() != null) person.setPhoneNumber(emptyToNull(patch.phoneNumber()));
        if (patch.occupation() != null) person.setOccupation(emptyToNull(patch.occupation()));
        if (patch.sourceOfFunds() != null) person.setSourceOfFunds(emptyToNull(patch.sourceOfFunds()));
    }

    private static String emptyToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private void assertSameFirm(BeneficialOwner person, Deal deal) {
        if (!person.getRealEstateFirmId().equals(firmIdFor(deal))) {
            throw new ForbiddenException("That person belongs to another reporting entity");
        }
    }

    /**
     * A node with children cannot become an individual, for the same reason an individual cannot
     * be given children: the type says it owns nothing.
     */
    private void assertRetypeAllowed(OwnershipNode n, NodeType next) {
        if (next.isLeafOnly() && !edges.findAllByParentNodeId(n.getId()).isEmpty()) {
            throw new BadRequestException(
                    "\"" + n.getDisplayName() + "\" owns other nodes, so it cannot become an individual."
                            + " Detach them first.");
        }
    }

    private Deal assertReadable(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        lifecycle.assertCanRead(deal, currentPrincipal(), firmIdFor(deal));
        return deal;
    }

    private Long firmIdFor(Deal deal) {
        return branches.findById(deal.getFirmBranchId())
                .map(FirmBranch::getRealEstateFirmId).orElse(null);
    }

    /** Loads a node and ensures it belongs to the given deal's structure. */
    private OwnershipNode mustLoadNodeForDeal(Deal deal, Long nodeId) {
        OwnershipNode n = nodes.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found"));
        OwnershipStructure structure = structures.findById(n.getOwnershipStructureId())
                .orElseThrow(() -> new NotFoundException("Structure for node " + nodeId + " not found"));
        if (!structure.getDealId().equals(deal.getId())) {
            throw new BadRequestException("Node " + nodeId + " does not belong to deal " + deal.getId());
        }
        return n;
    }

    /** BFS from `start`. Returns true if `target` is reachable following parent→child edges. */
    private boolean canReach(Long start, Long target) {
        if (start.equals(target)) return true;
        Deque<Long> frontier = new ArrayDeque<>();
        Set<Long> seen = new HashSet<>();
        frontier.add(start);
        seen.add(start);
        while (!frontier.isEmpty()) {
            Long current = frontier.pollFirst();
            for (OwnershipEdge edge : edges.findAllByParentNodeId(current)) {
                Long child = edge.getChildNodeId();
                if (child.equals(target)) return true;
                if (seen.add(child)) frontier.add(child);
            }
        }
        return false;
    }

    private static BigDecimal normalisePercentage(BigDecimal v) {
        if (v == null) return null;
        if (v.signum() < 0 || v.compareTo(new BigDecimal("100")) > 0) {
            throw new BadRequestException("Percentage must be between 0 and 100");
        }
        return v.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private void applyNodeFields(OwnershipNode n,
                                 java.time.LocalDate dob, String idType, String idNumber, String idCountry,
                                 String nzbn, String companyNumber, java.time.LocalDate incorpDate, String regOffice,
                                 String trustName, Long trustDeedDocId, String settlorName,
                                 String extraJson) {
        if (dob != null) n.setDateOfBirth(dob);
        if (idType != null) n.setIdDocumentType(idType);
        if (idNumber != null) n.setIdDocumentNumber(idNumber);
        if (idCountry != null) n.setIdDocumentCountry(idCountry);
        if (nzbn != null) n.setNzbn(nzbn);
        if (companyNumber != null) n.setCompanyNumber(companyNumber);
        if (incorpDate != null) n.setIncorporationDate(incorpDate);
        if (regOffice != null) n.setRegisteredOffice(regOffice);
        if (trustName != null) n.setTrustName(trustName);
        if (trustDeedDocId != null) n.setTrustDeedDocumentId(trustDeedDocId);
        if (settlorName != null) n.setSettlorName(settlorName);
        if (extraJson != null) n.setExtraJson(extraJson);
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
