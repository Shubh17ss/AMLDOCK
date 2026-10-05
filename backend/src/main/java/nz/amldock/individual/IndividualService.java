package nz.amldock.individual;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.common.web.IdPage;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.PageResponse;
import nz.amldock.deal.DealListService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealScope;
import nz.amldock.deal.DealService;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.document.DocumentService;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.ownership.dto.PersonDto;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The natural people behind a branch's deals, as one list.
 *
 * <p>Every other beneficial-owner read in this codebase hangs off a single deal. The CDD registers
 * ask the other question — who has this branch done diligence on — and there was nothing to answer
 * it with.
 *
 * <p><strong>Reached through the deal, not through {@code deal_beneficial_owner}.</strong> That
 * link table only holds people who arrived on a scanned ID; an individual a reviewer typed in by
 * hand gets a person record but no link row, so joining through it would quietly drop them. The
 * structure is the complete path.
 *
 * <p>Authorisation is {@link DealScope}, so the register can only ever show people
 * standing on deals the caller could already open. An agent sees the individuals on their own
 * deals, a branch admin their branch's, a compliance officer their firm's.
 */
@Service
public class IndividualService {

    private final DealService dealService;
    private final DealListService dealList;
    private final IndividualQuery query;
    private final DealRepository deals;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final BeneficialOwnerRepository owners;
    private final PropertyRepository properties;
    private final DocumentService documentService;

    public IndividualService(DealService dealService,
                             DealListService dealList,
                             IndividualQuery query,
                             DealRepository deals,
                             OwnershipStructureRepository structures,
                             OwnershipNodeRepository nodes,
                             BeneficialOwnerRepository owners,
                             PropertyRepository properties,
                             DocumentService documentService) {
        this.dealService = dealService;
        this.dealList = dealList;
        this.query = query;
        this.deals = deals;
        this.structures = structures;
        this.nodes = nodes;
        this.owners = owners;
        this.properties = properties;
        this.documentService = documentService;
    }

    /**
     * One page of the register. {@link IndividualQuery} filters, searches, scopes and orders in
     * SQL and returns the page's node ids; only those rows are then loaded and mapped.
     */
    @Transactional(readOnly = true)
    public PageResponse<IndividualRowDto> list(IndividualQuery.Filter filter, PageRequests paging) {
        DealScope scope = dealList.scopeForCurrentUser(filter.firmId(), filter.branchId());
        IdPage ids = query.page(scope, filter, paging.size(), paging.offset());
        return PageResponse.of(rows(ids.ids()), paging, ids.total());
    }

    /** Rows for the given node ids, in that order. Bulk-loads each table once for the batch. */
    List<IndividualRowDto> rows(List<Long> nodeIds) {
        if (nodeIds.isEmpty()) return List.of();
        Map<Long, OwnershipNode> nodeById = byId(nodes.findAllById(nodeIds), OwnershipNode::getId);
        List<OwnershipNode> page = nodeIds.stream().map(nodeById::get).filter(java.util.Objects::nonNull).toList();

        Map<Long, Long> dealIdByStructureId = structures.findAllById(distinct(page, OwnershipNode::getOwnershipStructureId))
                .stream().collect(Collectors.toMap(OwnershipStructure::getId, OwnershipStructure::getDealId));
        Map<Long, Deal> dealById = byId(deals.findAllById(dealIdByStructureId.values().stream().distinct().toList()), Deal::getId);
        // Bulk-resolve, the same idiom the deals list uses: one query per lookup table rather
        // than one per row.
        Map<Long, BeneficialOwner> ownerById = byId(
                owners.findAllById(distinct(page, OwnershipNode::getBeneficialOwnerId)),
                BeneficialOwner::getId);
        Map<Long, Property> propertyById = byId(
                properties.findAllById(distinct(List.copyOf(dealById.values()), Deal::getPropertyId)), Property::getId);

        return page.stream().map(n -> {
            Deal deal = dealById.get(dealIdByStructureId.get(n.getOwnershipStructureId()));
            if (deal == null) return null;   // removed between the id query and this load
            Property property = propertyById.get(deal.getPropertyId());
            // Null when the person record was deleted out from under the node: beneficial_owner_id
            // is ON DELETE SET NULL, and the node is still a row the register owes the reader.
            BeneficialOwner person = n.getBeneficialOwnerId() == null
                    ? null : ownerById.get(n.getBeneficialOwnerId());

            return new IndividualRowDto(
                    n.getId(),
                    n.getNodeType(),
                    deal.getId(),
                    // Matches how the deals list renders a reference that was never generated.
                    deal.getReference() != null ? deal.getReference() : "#" + deal.getId(),
                    property == null ? null : DealService.formatAddress(property),
                    n.getDisplayName(),
                    // The node's copy first: extraction writes the person's and pushes it down, so
                    // the node carries what this deal was told, which is what this row is about.
                    // Both of the next two are person-shaped and come back null for a company or
                    // a trust — those never link to a beneficial_owner, and a company has an
                    // incorporation date rather than a birthday. The registers render the gap as a
                    // dash; the Overseas one keeps to natural persons so the gap is never read as
                    // "nobody asked".
                    n.getDateOfBirth() != null ? n.getDateOfBirth()
                            : (person == null ? null : person.getDateOfBirth()),
                    person == null ? null : person.getCountryOfResidence(),
                    n.getPersonRoles(),
                    n.getVerificationStatus(),
                    n.getVerifiedAt());
        }).filter(java.util.Objects::nonNull).toList();
    }

    /** Most rows one export will write. Far above any real register; a guard, not a feature. */
    static final int EXPORT_MAX_ROWS = 100_000;
    private static final int EXPORT_CHUNK = 1_000;

    /**
     * Every row matching the filter as CSV, written in chunks so memory stays flat however large
     * the register. Columns match what the registers exported when the CSV was built in the
     * browser; the exceptions register (filtered on a verification outcome) dates its rows by
     * verification instead of showing birth date and residence.
     *
     * @return how many rows were written
     */
    @Transactional(readOnly = true)
    public int export(IndividualQuery.Filter filter, Appendable out) throws java.io.IOException {
        DealScope scope = dealList.scopeForCurrentUser(filter.firmId(), filter.branchId());
        boolean exceptions = filter.verification() != null;
        out.append(exceptions ? IndividualCsv.EXCEPTION_HEADERS : IndividualCsv.REGISTER_HEADERS).append('\n');
        int written = 0;
        for (long offset = 0; written < EXPORT_MAX_ROWS; offset += EXPORT_CHUNK) {
            IdPage ids = query.page(scope, filter, EXPORT_CHUNK, offset);
            for (IndividualRowDto r : rows(ids.ids())) {
                out.append(exceptions ? IndividualCsv.exceptionRow(r) : IndividualCsv.registerRow(r)).append('\n');
                if (++written >= EXPORT_MAX_ROWS) break;
            }
            if (ids.ids().size() < EXPORT_CHUNK) break;
        }
        return written;
    }

    /**
     * One individual in full: everything a reviewer needs to recognise a person, and everything
     * worth copying onto a new owner on another deal.
     *
     * <p>Authorisation is {@link DealService#get(Long)}, which runs the same per-deal read check as
     * opening the deal itself. Deliberately that rather than a rule of its own — a person is
     * readable exactly because their file is, and a second copy of that rule could only ever drift
     * from the first.
     *
     * <p>Fetched one at a time, for the row somebody expanded. {@link IndividualRowDto} stays thin
     * because it is fetched by the hundred.
     */
    @Transactional(readOnly = true)
    public IndividualDetailDto detail(Long nodeId) {
        OwnershipNode node = nodes.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Individual " + nodeId + " not found"));
        // Not a 403: which nodes are individuals is not a secret, and a caller who asks about a
        // company here has asked the wrong question, not one they were forbidden to ask.
        if (node.getNodeType() != NodeType.INDIVIDUAL) {
            throw new NotFoundException("Node " + nodeId + " is not an individual");
        }
        OwnershipStructure structure = structures.findById(node.getOwnershipStructureId())
                .orElseThrow(() -> new NotFoundException("Structure for node " + nodeId + " not found"));

        // Throws when this caller may not read the deal. That is the whole authorisation story.
        DealDto deal = dealService.get(structure.getDealId());

        String address = deal.property() == null ? null
                : properties.findById(deal.property().id())
                        .map(DealService::formatAddress).orElse(null);
        // Null when the person record was deleted out from under the node — beneficial_owner_id is
        // ON DELETE SET NULL, and the node is still a real answer to "who is on this deal".
        BeneficialOwner person = node.getBeneficialOwnerId() == null ? null
                : owners.findById(node.getBeneficialOwnerId()).orElse(null);

        return new IndividualDetailDto(
                node.getId(),
                deal.id(),
                // Matches how the register renders a reference that was never generated.
                deal.reference() != null ? deal.reference() : "#" + deal.id(),
                address,
                node.getDisplayName(),
                node.getDateOfBirth(),
                node.getIdDocumentType(),
                node.getIdDocumentNumber(),
                node.getIdDocumentCountry(),
                node.getPersonRoles(),
                node.getVerificationStatus(),
                person == null ? null : PersonDto.from(person),
                // Through DocumentService rather than the repositories, so this list and the node
                // Documents tab can never disagree about what is on the file. It unions the node
                // documents with the person scans, which is the set the copy takes.
                documentService.listForNode(nodeId).stream().map(IndividualService::summarise).toList());
    }

    private static IndividualDetailDto.DocumentSummary summarise(DocumentDto d) {
        return new IndividualDetailDto.DocumentSummary(
                d.id(), d.originalFilename(), d.documentType(), d.idSide(), d.sizeBytes());
    }

    private static <T> List<Long> distinct(List<T> rows, Function<T, Long> id) {
        return rows.stream().map(id).filter(java.util.Objects::nonNull).distinct().toList();
    }

    private static <T> Map<Long, T> byId(List<T> rows, Function<T, Long> id) {
        return rows.stream().collect(Collectors.toMap(id, r -> r, (a, b) -> a));
    }
}
