package nz.amldock.deal.version;

import nz.amldock.beneficialowner.dto.BeneficialOwnerDto;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.deal.version.dto.DealVersionDto;
import nz.amldock.deal.version.dto.DealVersionSummaryDto;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.ownership.dto.EdgeDto;
import nz.amldock.ownership.dto.NodeDto;
import nz.amldock.ownership.dto.PersonDto;
import nz.amldock.ownership.dto.TreeDto;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Reads a deal version back as the deal it was.
 *
 * <p>Everything here answers in the DTOs the live deal already answers in — {@link DealDto},
 * {@link TreeDto}, {@link DocumentDto}, {@link BeneficialOwnerDto}. That is the whole design of the
 * read side: the snapshot entities extend the same {@code @MappedSuperclass} as their live twins,
 * so the existing DTO factories accept them unchanged, and the deal screen can render a version
 * with the components and the read-only mode it already has rather than a second set built to
 * mirror the first.
 *
 * <p>Permission is the deal's. A version is exactly as readable as the deal it belongs to, so
 * every entry point loads the live deal and runs {@code assertCanRead} against that.
 */
@Service
public class DealVersionReadService {

    private final DealVersionRepository versions;
    private final DealVersionPropertyRepository versionProperties;
    private final DealVersionClientRepository versionClients;
    private final DealVersionNodeRepository versionNodes;
    private final DealVersionEdgeRepository versionEdges;
    private final DealVersionDocumentRepository versionDocuments;
    private final DealVersionPersonRepository versionPeople;

    private final DealRepository deals;
    private final DealLifecycleService lifecycle;
    private final DealNoteService dealNotes;
    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final UserRepository users;
    private final FileStorageService storage;
    private final Duration downloadTtl;

    public DealVersionReadService(DealVersionRepository versions,
                                  DealVersionPropertyRepository versionProperties,
                                  DealVersionClientRepository versionClients,
                                  DealVersionNodeRepository versionNodes,
                                  DealVersionEdgeRepository versionEdges,
                                  DealVersionDocumentRepository versionDocuments,
                                  DealVersionPersonRepository versionPeople,
                                  DealRepository deals,
                                  DealLifecycleService lifecycle,
                                  DealNoteService dealNotes,
                                  FirmBranchRepository branches,
                                  RealEstateFirmRepository firms,
                                  UserRepository users,
                                  FileStorageService storage,
                                  @Value("${S3_DOWNLOAD_TTL_MINUTES:5}") long downloadTtlMinutes) {
        this.versions = versions;
        this.versionProperties = versionProperties;
        this.versionClients = versionClients;
        this.versionNodes = versionNodes;
        this.versionEdges = versionEdges;
        this.versionDocuments = versionDocuments;
        this.versionPeople = versionPeople;
        this.deals = deals;
        this.lifecycle = lifecycle;
        this.dealNotes = dealNotes;
        this.branches = branches;
        this.firms = firms;
        this.users = users;
        this.storage = storage;
        this.downloadTtl = Duration.ofMinutes(downloadTtlMinutes);
    }

    /** Every version of a deal, newest first — the Versions menu. */
    @Transactional(readOnly = true)
    public List<DealVersionSummaryDto> list(Long dealId) {
        mustReadDeal(dealId);
        List<DealVersion> rows = versions.findAllByDealIdOrderByVersionNoDesc(dealId);
        if (rows.isEmpty()) return List.of();

        Map<Long, User> people = namesFor(rows);
        return rows.stream().map(v -> summary(v, people)).toList();
    }

    /** One version, as the whole deal it was. */
    @Transactional(readOnly = true)
    public DealVersionDto get(Long dealId, Integer versionNo) {
        mustReadDeal(dealId);
        DealVersion v = mustFind(dealId, versionNo);
        Long vid = v.getId();

        FirmBranch branch = branches.findById(v.getFirmBranchId()).orElse(null);
        RealEstateFirm firm = branch == null ? null : firms.findById(branch.getRealEstateFirmId()).orElse(null);
        User creator = users.findById(v.getCreatedByUserId()).orElse(null);

        DealDto deal = DealDto.from(v,
                firm == null ? null : firm.getName(),
                branch == null ? null : branch.getName(),
                versionProperties.findByDealVersionId(vid).map(p -> nz.amldock.property.dto.PropertyDto.from(p)).orElse(null),
                versionClients.findByDealVersionId(vid).map(c -> nz.amldock.client.dto.ClientDto.from(c)).orElse(null),
                creator == null ? null : creator.getEmail());

        List<DealVersionDocument> docs = versionDocuments.findAllByDealVersionId(vid);
        List<DealVersionPerson> persons = versionPeople.findAllByDealVersionId(vid);

        return new DealVersionDto(
                summary(v, namesFor(List.of(v))),
                deal,
                tree(v, persons),
                documents(docs),
                beneficialOwners(persons, docs),
                dealNotes.timeline(v, v.getVerifiedAt()));
    }

    /**
     * A download URL for a document as this version listed it.
     *
     * <p>Separate from {@code DocumentService.presignDownload} because that one refuses anything
     * not {@code ACTIVE}, which is right for the live deal and wrong here: a document deleted after
     * this version was signed off has to stay readable <em>from this version</em>. That is the
     * whole point of the guard in {@code DocumentService.delete} that keeps its bytes.
     *
     * <p>Reached only through a version the caller may read, and answered from the version's own
     * copy of the key rather than the live row, which may be gone.
     */
    @Transactional(readOnly = true)
    public DownloadUrlResponse presignDownload(Long dealId, Integer versionNo, Long documentId) {
        mustReadDeal(dealId);
        DealVersion v = mustFind(dealId, versionNo);
        DealVersionDocument d = versionDocuments
                .findByDealVersionIdAndSourceDocumentId(v.getId(), documentId)
                .orElseThrow(() -> new NotFoundException(
                        "Document " + documentId + " is not part of version " + versionNo));

        String url = storage.presignDownload(d.getS3Key(), d.getOriginalFilename(), downloadTtl);
        return new DownloadUrlResponse(url, (int) downloadTtl.toSeconds());
    }

    /* ---------- assembling the payloads ---------- */

    /**
     * The ownership structure, in the shape {@code OwnershipService.loadTree} returns.
     *
     * <p>Node ids here are the live ids the version froze ({@code source_node_id}), which is what
     * lets the edges be copied verbatim: an edge naming node 42 still names node 42 inside the
     * version, so nothing has to be remapped on the way in or the way out.
     */
    private TreeDto tree(DealVersion v, List<DealVersionPerson> persons) {
        List<DealVersionNode> nodes = versionNodes.findAllByDealVersionId(v.getId());
        List<DealVersionEdge> edges = versionEdges.findAllByDealVersionId(v.getId());

        Map<Long, PersonDto> byOwner = persons.stream().collect(Collectors.toMap(
                DealVersionPerson::getBeneficialOwnerId, PersonDto::from, (a, b) -> a));

        List<NodeDto> nodeDtos = nodes.stream()
                .sorted(java.util.Comparator.comparing(DealVersionNode::getNodeId))
                .map(n -> NodeDto.from(n, byOwner.get(n.getBeneficialOwnerId())))
                .toList();

        return new TreeDto(
                null,                       // the live structure's id is not a fact about a version
                v.getDealId(),
                v.getRootNodeId(),
                v.getStructureNotes(),
                nodeDtos,
                edges.stream().map(EdgeDto::from).toList());
    }

    private List<DocumentDto> documents(List<DealVersionDocument> docs) {
        Map<Long, User> uploaders = users.findAllById(
                docs.stream().map(DealVersionDocument::getUploadedByUserId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        return docs.stream()
                .sorted(java.util.Comparator.comparing(DealVersionDocument::getCreatedAt).reversed())
                .map(d -> {
                    User u = d.getUploadedByUserId() == null ? null : uploaders.get(d.getUploadedByUserId());
                    return DocumentDto.from(d, u == null ? null : u.getEmail());
                })
                .toList();
    }

    /**
     * The people, with the ID-scan counts computed from the version's own documents.
     *
     * <p>{@code BeneficialOwnerService.toDto} counts live ACTIVE scans; counting them here instead
     * means the figure describes what was on the deal at sign-off rather than what survives now.
     */
    private List<BeneficialOwnerDto> beneficialOwners(List<DealVersionPerson> persons,
                                                     List<DealVersionDocument> docs) {
        return persons.stream().map(p -> {
            List<DealVersionDocument> scans = docs.stream()
                    .filter(d -> Objects.equals(d.getBeneficialOwnerId(), p.getBeneficialOwnerId()))
                    .filter(d -> d.getStatus() == DocumentStatus.ACTIVE)
                    .toList();
            String type = scans.stream().findFirst().map(d -> d.getDocumentType().name()).orElse(null);
            return BeneficialOwnerDto.from(p, type, scans.size());
        }).toList();
    }

    private DealVersionSummaryDto summary(DealVersion v, Map<Long, User> people) {
        User verifier = people.get(v.getVerifiedByUserId());
        User reopener = v.getReopenedByUserId() == null ? null : people.get(v.getReopenedByUserId());
        Long vid = v.getId();
        return new DealVersionSummaryDto(
                v.getVersionNo(),
                v.getVerifiedByUserId(),
                verifier == null ? null : verifier.getFullName(),
                verifier == null ? null : verifier.getEmail(),
                v.getVerifiedAt(),
                v.getVerifyNote(),
                v.getReopenedByUserId(),
                reopener == null ? null : reopener.getFullName(),
                v.getReopenedAt(),
                v.getReopenNote(),
                versionNodes.findAllByDealVersionId(vid).size(),
                versionDocuments.findAllByDealVersionId(vid).size(),
                versionPeople.findAllByDealVersionId(vid).size());
    }

    /* ---------- helpers ---------- */

    /** One query for every name the listing shows, rather than one per version. */
    private Map<Long, User> namesFor(List<DealVersion> rows) {
        List<Long> ids = new ArrayList<>();
        rows.forEach(v -> {
            ids.add(v.getVerifiedByUserId());
            if (v.getReopenedByUserId() != null) ids.add(v.getReopenedByUserId());
        });
        if (ids.isEmpty()) return Map.of();
        return users.findAllById(ids.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
    }

    private DealVersion mustFind(Long dealId, Integer versionNo) {
        return versions.findByDealIdAndVersionNo(dealId, versionNo)
                .orElseThrow(() -> new NotFoundException(
                        "Deal " + dealId + " has no version " + versionNo));
    }

    /**
     * Loads the deal and checks the caller may read it.
     *
     * <p>The same shape {@code DealService.get} uses: the firm comes from the deal's branch, and
     * {@code assertCanRead} decides. A version carries no permission of its own — it is the deal,
     * earlier.
     */
    private Deal mustReadDeal(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        FirmBranch branch = branches.findById(deal.getFirmBranchId()).orElse(null);
        Long firmId = branch == null ? null : branch.getRealEstateFirmId();
        lifecycle.assertCanRead(deal, currentPrincipal(), firmId);
        return deal;
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new NotFoundException("No authenticated user");
    }
}
