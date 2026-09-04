package nz.amldock.deal.version;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.beneficialowner.DealBeneficialOwner;
import nz.amldock.beneficialowner.DealBeneficialOwnerRepository;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.DocumentStatus;
import nz.amldock.ownership.OwnershipEdge;
import nz.amldock.ownership.OwnershipEdgeRepository;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.property.PropertyRepository;
import nz.amldock.user.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Writes and stamps deal versions. The read side is {@link DealVersionReadService}.
 *
 * <p>Everything here runs inside the caller's transaction — {@code DealService.act} and
 * {@code DealService.override} — so a verification either records its snapshot or does not happen.
 * A deal that reached VERIFIED with no version behind it would be a sign-off pointing at nothing,
 * and the reopen that follows would then quietly lose the record it was supposed to preserve.
 */
@Service
public class DealVersionService {

    private final DealVersionRepository versions;
    private final DealVersionPropertyRepository versionProperties;
    private final DealVersionClientRepository versionClients;
    private final DealVersionNodeRepository versionNodes;
    private final DealVersionEdgeRepository versionEdges;
    private final DealVersionDocumentRepository versionDocuments;
    private final DealVersionPersonRepository versionPeople;

    private final PropertyRepository properties;
    private final ClientRepository clients;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final OwnershipEdgeRepository edges;
    private final DocumentRepository documents;
    private final DealBeneficialOwnerRepository dealOwners;
    private final BeneficialOwnerRepository owners;

    public DealVersionService(DealVersionRepository versions,
                              DealVersionPropertyRepository versionProperties,
                              DealVersionClientRepository versionClients,
                              DealVersionNodeRepository versionNodes,
                              DealVersionEdgeRepository versionEdges,
                              DealVersionDocumentRepository versionDocuments,
                              DealVersionPersonRepository versionPeople,
                              PropertyRepository properties,
                              ClientRepository clients,
                              OwnershipStructureRepository structures,
                              OwnershipNodeRepository nodes,
                              OwnershipEdgeRepository edges,
                              DocumentRepository documents,
                              DealBeneficialOwnerRepository dealOwners,
                              BeneficialOwnerRepository owners) {
        this.versions = versions;
        this.versionProperties = versionProperties;
        this.versionClients = versionClients;
        this.versionNodes = versionNodes;
        this.versionEdges = versionEdges;
        this.versionDocuments = versionDocuments;
        this.versionPeople = versionPeople;
        this.properties = properties;
        this.clients = clients;
        this.structures = structures;
        this.nodes = nodes;
        this.edges = edges;
        this.documents = documents;
        this.dealOwners = dealOwners;
        this.owners = owners;
    }

    /**
     * Freezes the deal if this transition has just verified it.
     *
     * <p>Called from every path that changes a status, and it decides for itself whether there is
     * anything to do. That is the point: the two callers — the VERIFY verb and a senior manager's
     * override — should not each have to remember the rule, and a third one added later gets it
     * without being told.
     *
     * <p>The test is <em>entering</em> VERIFIED, not being in it. A deal already verified cannot
     * reach here (no rule leaves VERIFIED for VERIFIED, and {@code override} rejects a no-op
     * target), but stating it means a version is one verification, never a re-save of the same one.
     *
     * @param previous the status the deal came from
     * @param note     the verification note; it is the version's own record of why it passed
     */
    @Transactional
    public void snapshotIfVerified(Deal deal, UserPrincipal actor, String note, DealStatus previous) {
        if (deal.getStatus() != DealStatus.VERIFIED || previous == DealStatus.VERIFIED) return;
        snapshot(deal, actor, note);
    }

    /**
     * Stamps the current version with who reopened it and why.
     *
     * <p>The snapshot columns are untouched — this only completes the record of that version's
     * life, so a reader can see not just what was signed off but that it was later taken back and
     * on what grounds. A deal verified before this feature existed has no version to stamp, so
     * the absence is tolerated rather than treated as an error.
     */
    @Transactional
    public void recordReopen(Deal deal, UserPrincipal actor, String note) {
        versions.findTopByDealIdOrderByVersionNoDesc(deal.getId()).ifPresent(v -> {
            v.setReopenedByUserId(actor.id());
            v.setReopenedAt(Instant.now());
            v.setReopenNote(note);
            versions.save(v);
        });
    }

    /* ---------- the copy itself ---------- */

    private void snapshot(Deal deal, UserPrincipal actor, String note) {
        int versionNo = versions.findTopByDealIdOrderByVersionNoDesc(deal.getId())
                .map(v -> v.getVersionNo() + 1)
                .orElse(1);

        DealVersion version = DealVersion.copyOf(deal, versionNo, actor.id(), note);

        OwnershipStructure structure = structures.findByDealId(deal.getId()).orElse(null);
        if (structure != null) {
            version.setRootNodeId(structure.getRootNodeId());
            version.setStructureNotes(structure.getNotes());
        }
        // Saved before its children so they have an id to hang from. uq_deal_version is what makes
        // the version number above safe: two verifications racing produce a constraint violation
        // rather than two rows both calling themselves version 3, which is the failure
        // compliance_document's read-max-and-add-one still has.
        DealVersion saved = versions.save(version);
        Long vid = saved.getId();

        properties.findById(deal.getPropertyId())
                .ifPresent(p -> versionProperties.save(DealVersionProperty.copyOf(p, vid)));
        clients.findById(deal.getClientId())
                .ifPresent(c -> versionClients.save(DealVersionClient.copyOf(c, vid)));

        copyStructure(structure, vid);
        copyDocuments(deal, vid);
        copyPeople(deal, vid);
    }

    private void copyStructure(OwnershipStructure structure, Long vid) {
        if (structure == null) return;

        List<OwnershipNode> nodeList = nodes.findAllByOwnershipStructureIdOrderByIdAsc(structure.getId());
        versionNodes.saveAll(nodeList.stream().map(n -> DealVersionNode.copyOf(n, vid)).toList());

        // Same shape as OwnershipService.loadTree: edges are found from their parents, so an empty
        // structure asks nothing rather than querying for an empty IN list.
        List<Long> nodeIds = nodeList.stream().map(OwnershipNode::getId).toList();
        if (nodeIds.isEmpty()) return;
        List<OwnershipEdge> edgeList = edges.findAllByParentNodeIdIn(nodeIds);
        versionEdges.saveAll(edgeList.stream().map(e -> DealVersionEdge.copyOf(e, vid)).toList());
    }

    /**
     * Only ACTIVE documents, which is what {@code DocumentService.listForDeal} shows and therefore
     * what the reviewer actually had in front of them. A document already deleted before this
     * verification was not part of what was signed off.
     */
    private void copyDocuments(Deal deal, Long vid) {
        List<Document> docs = documents.findAllByDealIdAndStatusOrderByCreatedAtDesc(
                deal.getId(), DocumentStatus.ACTIVE);
        versionDocuments.saveAll(docs.stream().map(d -> DealVersionDocument.copyOf(d, vid)).toList());
    }

    /**
     * The people on the deal, copied rather than referenced.
     *
     * <p>{@code beneficial_owner} is firm-scoped and shared across a firm's deals, so the row this
     * version was checked against can be edited later by work on an entirely unrelated deal. The
     * link row carries which document introduced them, which is worth keeping alongside.
     */
    private void copyPeople(Deal deal, Long vid) {
        List<DealBeneficialOwner> links = dealOwners.findAllByDealIdOrderByCreatedAtAsc(deal.getId());
        if (links.isEmpty()) return;

        Map<Long, Long> sourceDocumentByOwner = links.stream().collect(Collectors.toMap(
                DealBeneficialOwner::getBeneficialOwnerId,
                l -> l.getSourceDocumentId() == null ? 0L : l.getSourceDocumentId(),
                (a, b) -> a));

        List<BeneficialOwner> people = owners.findAllById(sourceDocumentByOwner.keySet());
        versionPeople.saveAll(people.stream().map(p -> {
            Long docId = sourceDocumentByOwner.get(p.getId());
            return DealVersionPerson.copyOf(p, vid, docId == null || docId == 0L ? null : docId);
        }).toList());
    }

    /* ---------- helpers shared with the read side ---------- */

    static <T> Map<Long, T> byKey(List<T> items, Function<T, Long> key) {
        return items.stream().filter(Objects::nonNull)
                .collect(Collectors.toMap(key, Function.identity(), (a, b) -> a));
    }

    DealVersion mustFind(Long dealId, Integer versionNo) {
        return versions.findByDealIdAndVersionNo(dealId, versionNo)
                .orElseThrow(() -> new NotFoundException(
                        "Deal " + dealId + " has no version " + versionNo));
    }
}
