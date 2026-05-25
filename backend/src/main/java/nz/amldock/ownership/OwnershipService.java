package nz.amldock.ownership;

import nz.amldock.common.exception.BadRequestException;
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
import nz.amldock.ownership.dto.TreeDto;
import nz.amldock.ownership.dto.UpdateEdgeRequest;
import nz.amldock.ownership.dto.UpdateNodeRequest;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class OwnershipService {

    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final OwnershipEdgeRepository edges;
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final DealLifecycleService lifecycle;

    public OwnershipService(OwnershipStructureRepository structures,
                            OwnershipNodeRepository nodes,
                            OwnershipEdgeRepository edges,
                            DealRepository deals,
                            FirmBranchRepository branches,
                            DealLifecycleService lifecycle) {
        this.structures = structures;
        this.nodes = nodes;
        this.edges = edges;
        this.deals = deals;
        this.branches = branches;
        this.lifecycle = lifecycle;
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
        applyNodeFields(n, req.dateOfBirth(), req.idDocumentType(), req.idDocumentNumber(), req.idDocumentCountry(),
                req.nzbn(), req.companyNumber(), req.incorporationDate(), req.registeredOffice(),
                req.trustName(), req.trustDeedDocumentId(), req.settlorName(), req.extraJson());
        return NodeDto.from(nodes.save(n));
    }

    @Transactional
    public NodeDto updateNode(Long dealId, Long nodeId, UpdateNodeRequest req) {
        Deal deal = assertReadable(dealId);
        OwnershipNode n = mustLoadNodeForDeal(deal, nodeId);
        if (req.nodeType() != null) n.setNodeType(req.nodeType());
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
        return NodeDto.from(n);
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

        nodes.delete(n);
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
        return new TreeDto(
                structure.getId(),
                structure.getDealId(),
                structure.getRootNodeId(),
                structure.getNotes(),
                nodeList.stream().map(NodeDto::from).toList(),
                edgeList.stream().map(EdgeDto::from).toList());
    }

    private Deal assertReadable(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        Long firmId = branches.findById(deal.getFirmBranchId())
                .map(FirmBranch::getRealEstateFirmId).orElse(null);
        lifecycle.assertCanRead(deal, currentPrincipal(), firmId);
        return deal;
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
