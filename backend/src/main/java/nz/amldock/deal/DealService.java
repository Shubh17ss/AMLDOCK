package nz.amldock.deal;

import nz.amldock.client.Client;
import nz.amldock.client.ClientRepository;
import nz.amldock.client.dto.ClientDto;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.dto.PropertyDto;
import nz.amldock.property.dto.PropertyInput;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DealService {

    private final DealRepository deals;
    private final PropertyRepository properties;
    private final ClientRepository clients;
    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final UserRepository users;
    private final DealLifecycleService lifecycle;

    public DealService(DealRepository deals,
                       PropertyRepository properties,
                       ClientRepository clients,
                       FirmBranchRepository branches,
                       RealEstateFirmRepository firms,
                       UserRepository users,
                       DealLifecycleService lifecycle) {
        this.deals = deals;
        this.properties = properties;
        this.clients = clients;
        this.branches = branches;
        this.firms = firms;
        this.users = users;
        this.lifecycle = lifecycle;
    }

    /* ---------- queries ---------- */

    @Transactional(readOnly = true)
    public List<DealListItemDto> list(DealStatus status, Long firmIdFilter, Long branchIdFilter) {
        UserPrincipal actor = currentPrincipal();

        Long effectiveCreator = null;
        Long effectiveFirm = firmIdFilter;
        switch (actor.role()) {
            case BROKER -> effectiveCreator = actor.id();
            case FIRM_USER -> effectiveFirm = actor.realEstateFirmId();
            case COMPLIANCE, MANAGER -> { /* honour passed filters verbatim */ }
        }

        List<Deal> results = deals.search(status, effectiveCreator, effectiveFirm, branchIdFilter);
        if (results.isEmpty()) return List.of();

        // Bulk-resolve lookups
        Map<Long, FirmBranch> branchById = branches.findAllById(distinctLongs(results, Deal::getFirmBranchId)).stream()
                .collect(java.util.stream.Collectors.toMap(FirmBranch::getId, b -> b));
        Map<Long, RealEstateFirm> firmById = firms.findAllById(branchById.values().stream()
                .map(FirmBranch::getRealEstateFirmId).distinct().toList())
                .stream().collect(java.util.stream.Collectors.toMap(RealEstateFirm::getId, f -> f));
        Map<Long, Property> propertyById = properties.findAllById(distinctLongs(results, Deal::getPropertyId)).stream()
                .collect(java.util.stream.Collectors.toMap(Property::getId, p -> p));
        Map<Long, Client> clientById = clients.findAllById(distinctLongs(results, Deal::getClientId)).stream()
                .collect(java.util.stream.Collectors.toMap(Client::getId, c -> c));
        Map<Long, User> userById = users.findAllById(distinctLongs(results, Deal::getCreatedByUserId)).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));

        return results.stream().map(d -> {
            FirmBranch b = branchById.get(d.getFirmBranchId());
            RealEstateFirm f = b == null ? null : firmById.get(b.getRealEstateFirmId());
            Client c = clientById.get(d.getClientId());
            Property p = propertyById.get(d.getPropertyId());
            User u = userById.get(d.getCreatedByUserId());
            return DealListItemDto.from(d,
                    f == null ? null : f.getName(),
                    b == null ? null : b.getName(),
                    c == null ? null : c.getDisplayName(),
                    p == null ? null : formatAddress(p),
                    u == null ? null : u.getEmail());
        }).toList();
    }

    @Transactional(readOnly = true)
    public DealDto get(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        FirmBranch branch = branches.findById(d.getFirmBranchId()).orElse(null);
        RealEstateFirm firm = branch == null ? null : firms.findById(branch.getRealEstateFirmId()).orElse(null);
        lifecycle.assertCanRead(d, currentPrincipal(), firm == null ? null : firm.getId());
        Property p = properties.findById(d.getPropertyId()).orElse(null);
        Client c = clients.findById(d.getClientId()).orElse(null);
        User creator = users.findById(d.getCreatedByUserId()).orElse(null);
        return DealDto.from(d,
                firm == null ? null : firm.getName(),
                branch == null ? null : branch.getName(),
                p == null ? null : PropertyDto.from(p),
                c == null ? null : ClientDto.from(c),
                creator == null ? null : creator.getEmail());
    }

    /* ---------- mutations ---------- */

    @Transactional
    public Deal create(CreateDealRequest req) {
        UserPrincipal actor = currentPrincipal();
        if (actor.role() != Role.BROKER) {
            throw new BadRequestException("Only brokers may create deals");
        }
        FirmBranch branch = branches.findById(req.firmBranchId())
                .orElseThrow(() -> new BadRequestException("Branch " + req.firmBranchId() + " not found"));
        if (!branch.isActive()) {
            throw new BadRequestException("Branch is inactive");
        }

        Property property = new Property();
        applyPropertyInput(property, req.property());
        Property savedProp = properties.save(property);

        Client client = new Client();
        client.setDisplayName(req.client().displayName());
        client.setClientType(req.client().clientType());
        client.setEmail(req.client().email());
        client.setPhone(req.client().phone());
        Client savedClient = clients.save(client);

        Deal d = new Deal();
        d.setFirmBranchId(branch.getId());
        d.setPropertyId(savedProp.getId());
        d.setClientId(savedClient.getId());
        d.setStatus(DealStatus.DRAFT);
        d.setTransactionType(req.transactionType());
        d.setTransactionValueNzd(req.transactionValueNzd());
        d.setPocName(orFallback(req.pocName(), branch.getManagerName()));
        d.setPocRole(req.pocRole());
        d.setPocPhone(orFallback(req.pocPhone(), branch.getPhone()));
        d.setPocEmail(orFallback(req.pocEmail(), branch.getEmail()));
        d.setCreatedByUserId(actor.id());
        Deal saved = deals.save(d);

        // Generate human reference now that we have an id
        int year = OffsetDateTime.now(ZoneOffset.UTC).getYear();
        saved.setReference(String.format("DEAL-%d-%04d", year, saved.getId()));
        return saved;
    }

    @Transactional
    public Deal update(Long id, UpdateDealRequest req) {
        Deal d = mustFindEditable(id);
        if (req.firmBranchId() != null && !req.firmBranchId().equals(d.getFirmBranchId())) {
            FirmBranch newBranch = branches.findById(req.firmBranchId())
                    .orElseThrow(() -> new BadRequestException("Branch " + req.firmBranchId() + " not found"));
            if (!newBranch.isActive()) {
                throw new BadRequestException("Branch is inactive");
            }
            d.setFirmBranchId(newBranch.getId());
        }
        if (req.transactionType() != null) d.setTransactionType(req.transactionType());
        if (req.transactionValueNzd() != null) d.setTransactionValueNzd(req.transactionValueNzd());
        if (req.pocName() != null) d.setPocName(req.pocName());
        if (req.pocRole() != null) d.setPocRole(req.pocRole());
        if (req.pocPhone() != null) d.setPocPhone(req.pocPhone());
        if (req.pocEmail() != null) d.setPocEmail(req.pocEmail());
        return d;
    }

    @Transactional
    public Property updateProperty(Long dealId, PropertyInput input) {
        Deal d = mustFindEditable(dealId);
        Property p = properties.findById(d.getPropertyId())
                .orElseThrow(() -> new NotFoundException("Property not found"));
        applyPropertyInput(p, input); // idempotent to allow partial updates
        return p;
    }

    @Transactional
    public Client updateClient(Long dealId, ClientInput input) {
        Deal d = mustFindEditable(dealId);
        Client c = clients.findById(d.getClientId())
                .orElseThrow(() -> new NotFoundException("Client not found"));
        c.setDisplayName(input.displayName());
        c.setClientType(input.clientType());
        c.setEmail(input.email());
        c.setPhone(input.phone());
        return c;
    }

    @Transactional
    public void delete(Long id) {
        Deal d = mustFindEditable(id);
        Long propertyId = d.getPropertyId();
        Long clientId = d.getClientId();
        deals.delete(d);
        // Property and client are 1-1 with deal, so safe to clean up.
        properties.deleteById(propertyId);
        clients.deleteById(clientId);
    }

    @Transactional
    public Deal submit(Long id) {
        Deal d = mustFindEditable(id);
        lifecycle.submit(d, currentPrincipal());
        return d;
    }

    @Transactional
    public Deal assign(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assign(d, currentPrincipal());
        return d;
    }

    @Transactional
    public Deal approve(Long id, String notes) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.approve(d, currentPrincipal(), notes);
        return d;
    }

    @Transactional
    public Deal reject(Long id, String notes) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.reject(d, currentPrincipal(), notes);
        return d;
    }

    /** Returns a pair of (deal, previousStatus) so the controller can audit the transition. */
    @Transactional
    public OverrideResult override(Long id, DealStatus target, String reason) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        DealStatus previous = lifecycle.override(d, currentPrincipal(), target, reason);
        return new OverrideResult(d, previous);
    }

    public record OverrideResult(Deal deal, DealStatus previousStatus) {}

    /* ---------- helpers ---------- */

    private Deal mustFindEditable(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertOwnerEditable(d, currentPrincipal());
        return d;
    }

    private void applyPropertyInput(Property p, PropertyInput input) {
        if (input == null) return;
        if (input.addressLine1() != null) p.setAddressLine1(input.addressLine1());
        if (input.addressLine2() != null) p.setAddressLine2(input.addressLine2());
        if (input.suburb() != null) p.setSuburb(input.suburb());
        if (input.district() != null) p.setDistrict(input.district());
        if (input.region() != null) p.setRegion(input.region());
        if (input.country() != null) p.setCountry(input.country());
        if (input.postcode() != null) p.setPostcode(input.postcode());
        if (input.titleReference() != null) p.setTitleReference(input.titleReference());
        if (input.legalDescription() != null) p.setLegalDescription(input.legalDescription());
        if (input.landAreaSqm() != null) p.setLandAreaSqm(input.landAreaSqm());
    }

    private static String orFallback(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) return preferred;
        return fallback;
    }

    private static String formatAddress(Property p) {
        StringBuilder sb = new StringBuilder();
        appendPart(sb, p.getAddressLine1());
        appendPart(sb, p.getSuburb());
        appendPart(sb, p.getDistrict());
        appendPart(sb, p.getRegion());
        return sb.length() == 0 ? null : sb.toString();
    }

    private static void appendPart(StringBuilder sb, String part) {
        if (part == null || part.isBlank()) return;
        if (sb.length() > 0) sb.append(", ");
        sb.append(part);
    }

    private static List<Long> distinctLongs(List<Deal> ds, java.util.function.Function<Deal, Long> fn) {
        return ds.stream().map(fn).filter(java.util.Objects::nonNull).distinct().toList();
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }

    // expose for controller resolving DTOs after mutation
    public DealDto toDtoAfterMutation(Deal d) {
        FirmBranch b = branches.findById(d.getFirmBranchId()).orElse(null);
        RealEstateFirm f = b == null ? null : firms.findById(b.getRealEstateFirmId()).orElse(null);
        Property p = properties.findById(d.getPropertyId()).orElse(null);
        Client c = clients.findById(d.getClientId()).orElse(null);
        User creator = users.findById(d.getCreatedByUserId()).orElse(null);
        return DealDto.from(d,
                f == null ? null : f.getName(),
                b == null ? null : b.getName(),
                p == null ? null : PropertyDto.from(p),
                c == null ? null : ClientDto.from(c),
                creator == null ? null : creator.getEmail());
    }
}
