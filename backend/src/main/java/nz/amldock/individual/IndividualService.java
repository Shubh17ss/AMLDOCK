package nz.amldock.individual;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealService;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
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
 * <p>Authorisation is {@link DealService#readableDeals}, so the register can only ever show people
 * standing on deals the caller could already open. An agent sees the individuals on their own
 * deals, a branch admin their branch's, a compliance officer their firm's.
 */
@Service
public class IndividualService {

    private final DealService dealService;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;
    private final BeneficialOwnerRepository owners;
    private final PropertyRepository properties;

    public IndividualService(DealService dealService,
                             OwnershipStructureRepository structures,
                             OwnershipNodeRepository nodes,
                             BeneficialOwnerRepository owners,
                             PropertyRepository properties) {
        this.dealService = dealService;
        this.structures = structures;
        this.nodes = nodes;
        this.owners = owners;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public List<IndividualRowDto> list(Long firmId, Long branchId) {
        List<Deal> deals = dealService.readableDeals(null, firmId, branchId);
        if (deals.isEmpty()) return List.of();

        Map<Long, Deal> dealById = deals.stream().collect(Collectors.toMap(Deal::getId, d -> d));

        List<OwnershipStructure> structureList = structures.findAllByDealIdIn(dealById.keySet());
        if (structureList.isEmpty()) return List.of();
        Map<Long, Long> dealIdByStructureId = structureList.stream()
                .collect(Collectors.toMap(OwnershipStructure::getId, OwnershipStructure::getDealId));

        List<OwnershipNode> individuals = nodes
                .findAllByOwnershipStructureIdInAndNodeTypeOrderByIdAsc(
                        dealIdByStructureId.keySet(), NodeType.INDIVIDUAL);
        if (individuals.isEmpty()) return List.of();

        // Bulk-resolve, the same idiom DealService.list uses: one query per lookup table rather
        // than one per row.
        Map<Long, BeneficialOwner> ownerById = byId(
                owners.findAllById(distinct(individuals, OwnershipNode::getBeneficialOwnerId)),
                BeneficialOwner::getId);
        Map<Long, Property> propertyById = byId(
                properties.findAllById(distinct(deals, Deal::getPropertyId)), Property::getId);

        return individuals.stream().map(n -> {
            Deal deal = dealById.get(dealIdByStructureId.get(n.getOwnershipStructureId()));
            if (deal == null) return null;   // a structure whose deal fell out of scope
            Property property = propertyById.get(deal.getPropertyId());
            // Null when the person record was deleted out from under the node: beneficial_owner_id
            // is ON DELETE SET NULL, and the node is still a row the register owes the reader.
            BeneficialOwner person = n.getBeneficialOwnerId() == null
                    ? null : ownerById.get(n.getBeneficialOwnerId());

            return new IndividualRowDto(
                    n.getId(),
                    deal.getId(),
                    // Matches how the deals list renders a reference that was never generated.
                    deal.getReference() != null ? deal.getReference() : "#" + deal.getId(),
                    property == null ? null : DealService.formatAddress(property),
                    n.getDisplayName(),
                    // The node's copy first: extraction writes the person's and pushes it down, so
                    // the node carries what this deal was told, which is what this row is about.
                    n.getDateOfBirth() != null ? n.getDateOfBirth()
                            : (person == null ? null : person.getDateOfBirth()),
                    person == null ? null : person.getCountryOfResidence(),
                    n.getPersonRole(),
                    n.getVerificationStatus());
        }).filter(java.util.Objects::nonNull).toList();
    }

    private static <T> List<Long> distinct(List<T> rows, Function<T, Long> id) {
        return rows.stream().map(id).filter(java.util.Objects::nonNull).distinct().toList();
    }

    private static <T> Map<Long, T> byId(List<T> rows, Function<T, Long> id) {
        return rows.stream().collect(Collectors.toMap(id, r -> r));
    }
}
