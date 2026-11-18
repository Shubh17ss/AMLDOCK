package nz.amldock.ownership;

import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.dto.VerificationTrailEntryDto;
import nz.amldock.property.PropertyRepository;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The verifications granted to one person or entity on every deal they have been picked onto.
 *
 * <p>"The same person" is the node's identity key: a copy made from the owner picker carries its
 * source's, a node entered by hand starts its own. One row per deal, showing that deal's current
 * verification. Confined to the deal's firm — a person record never crosses reporting entities.
 *
 * <p>Its own service rather than more of {@link OwnershipService}, which needs nothing it reads.
 */
@Service
public class VerificationTrailService {

    private static final EnumSet<NodeVerificationStatus> VERIFIED = EnumSet.of(
            NodeVerificationStatus.VERIFIED, NodeVerificationStatus.VERIFIED_WITH_EXCEPTION);

    private final OwnershipNodeRepository nodes;
    private final OwnershipStructureRepository structures;
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final PropertyRepository properties;
    private final UserRepository users;
    private final DealLifecycleService lifecycle;

    public VerificationTrailService(OwnershipNodeRepository nodes,
                                    OwnershipStructureRepository structures,
                                    DealRepository deals,
                                    FirmBranchRepository branches,
                                    PropertyRepository properties,
                                    UserRepository users,
                                    DealLifecycleService lifecycle) {
        this.nodes = nodes;
        this.structures = structures;
        this.deals = deals;
        this.branches = branches;
        this.properties = properties;
        this.users = users;
        this.lifecycle = lifecycle;
    }

    @Transactional(readOnly = true)
    public List<VerificationTrailEntryDto> trail(Long dealId, Long nodeId) {
        UserPrincipal actor = currentPrincipal();
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        Long firmId = firmOf(deal);
        lifecycle.assertCanRead(deal, actor, firmId);

        OwnershipNode node = nodes.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found"));
        Long structureDealId = structures.findById(node.getOwnershipStructureId())
                .map(OwnershipStructure::getDealId).orElse(null);
        if (!Objects.equals(structureDealId, dealId)) {
            throw new NotFoundException("Node " + nodeId + " not found on deal " + dealId);
        }

        List<OwnershipNode> same = nodes.findAllByIdentityKeyAndVerificationStatusIn(
                node.getIdentityKey(), VERIFIED);
        if (same.isEmpty()) return List.of();

        Map<Long, Long> dealIdByStructure = structures.findAllById(
                        same.stream().map(OwnershipNode::getOwnershipStructureId).distinct().toList())
                .stream().collect(Collectors.toMap(OwnershipStructure::getId, OwnershipStructure::getDealId));
        Map<Long, Deal> dealById = deals.findAllById(dealIdByStructure.values().stream().distinct().toList())
                .stream().collect(Collectors.toMap(Deal::getId, Function.identity()));
        Map<Long, FirmBranch> branchById = branches.findAllById(
                        dealById.values().stream().map(Deal::getFirmBranchId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(FirmBranch::getId, Function.identity()));
        Map<Long, String> addressByProperty = properties.findAllById(
                        dealById.values().stream().map(Deal::getPropertyId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(p -> p.getId(), DealService::formatAddress,
                        (a, b) -> a));
        Map<Long, String> nameByUser = users.findAllById(
                        same.stream().map(OwnershipNode::getVerifiedByUserId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u.getFullName() == null ? u.getEmail() : u.getFullName(),
                        (a, b) -> a));

        return same.stream()
                .map(n -> {
                    Deal d = dealById.get(dealIdByStructure.get(n.getOwnershipStructureId()));
                    if (d == null) return null;
                    FirmBranch b = branchById.get(d.getFirmBranchId());
                    // Same reporting entity only, whatever the key says.
                    if (b == null || !Objects.equals(b.getRealEstateFirmId(), firmId)) return null;
                    return new VerificationTrailEntryDto(
                            n.getId(),
                            d.getPublicId(),
                            d.getReference() != null ? d.getReference() : "#" + d.getPublicId(),
                            d.getPropertyId() == null ? null : addressByProperty.get(d.getPropertyId()),
                            b.getId(),
                            b.getName(),
                            n.getVerificationStatus(),
                            n.getVerifiedAt(),
                            n.getVerifiedByUserId() == null ? null : nameByUser.get(n.getVerifiedByUserId()),
                            d.getId().equals(dealId),
                            canRead(d, actor, firmId));
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(VerificationTrailEntryDto::verifiedAt,
                        Comparator.nullsLast(Comparator.<Instant>reverseOrder())))
                .toList();
    }

    private boolean canRead(Deal d, UserPrincipal actor, Long firmId) {
        try {
            lifecycle.assertCanRead(d, actor, firmId);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private Long firmOf(Deal deal) {
        return deal.getFirmBranchId() == null ? null
                : branches.findById(deal.getFirmBranchId()).map(FirmBranch::getRealEstateFirmId).orElse(null);
    }

    private static UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new nz.amldock.common.exception.BadRequestException("No authenticated user");
    }
}
