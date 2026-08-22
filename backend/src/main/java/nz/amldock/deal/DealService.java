package nz.amldock.deal;

import nz.amldock.client.Client;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.client.dto.ClientDto;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.dealnote.dto.DealNoteDto;
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

import java.math.BigDecimal;
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
    private final DealNoteService dealNotes;
    private final BeneficialOwnerService beneficialOwners;
    private final DealRiskService risk;

    public DealService(DealRepository deals,
                       PropertyRepository properties,
                       ClientRepository clients,
                       FirmBranchRepository branches,
                       RealEstateFirmRepository firms,
                       UserRepository users,
                       DealLifecycleService lifecycle,
                       DealNoteService dealNotes,
                       BeneficialOwnerService beneficialOwners,
                       DealRiskService risk) {
        this.deals = deals;
        this.properties = properties;
        this.clients = clients;
        this.branches = branches;
        this.firms = firms;
        this.users = users;
        this.lifecycle = lifecycle;
        this.dealNotes = dealNotes;
        this.beneficialOwners = beneficialOwners;
        this.risk = risk;
    }

    /* ---------- queries ---------- */

    @Transactional(readOnly = true)
    public List<DealListItemDto> list(DealStatus status, Long firmIdFilter, Long branchIdFilter) {
        UserPrincipal actor = currentPrincipal();

        Long effectiveCreator = null;
        Long effectiveFirm = firmIdFilter;
        Long effectiveBranch = branchIdFilter;
        switch (actor.role()) {
            case AGENT, AGENT_PA -> effectiveCreator = actor.id();
            case ADMIN, SALES_MANAGER -> effectiveBranch = actor.firmBranchId();
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> effectiveFirm = actor.realEstateFirmId();
            // Both see every firm, so the caller's filters stand as given.
            case ROOT, AUDIT -> { /* honour passed filters verbatim */ }
            // Finance works in the fund register, not the CDD workspace. Stated rather than
            // left to fall through this switch, which would have handed over every deal.
            case FINANCE -> throw new ForbiddenException("Deals are outside the finance role");
        }

        List<Deal> results = deals.search(status, effectiveCreator, effectiveFirm, effectiveBranch);
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
        if (!DealLifecycleService.isDealAuthor(actor.role())) {
            throw new BadRequestException("Only agents may create deals");
        }
        // Agents can only create deals for the branch they're assigned to, so the request
        // needn't name it — the deal form omits it entirely. A value that disagrees is still
        // rejected rather than silently ignored.
        if (actor.firmBranchId() == null) {
            throw new ForbiddenException("You are not assigned to a branch — ask an administrator");
        }
        Long branchId = req.firmBranchId() == null ? actor.firmBranchId() : req.firmBranchId();
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));
        if (!branch.isActive()) {
            throw new BadRequestException("Branch is inactive");
        }
        if (!actor.firmBranchId().equals(branch.getId())) {
            throw new ForbiddenException("You can only create deals on your assigned branch");
        }
        validateValuationRange(req.valuationMin(), req.valuationMax());

        Property property = new Property();
        applyPropertyInput(property, req.property());
        // The property's jurisdiction is the reporting entity's, not something the broker states.
        property.setCountry(firmCountryOf(branch));
        Property savedProp = properties.save(property);

        // The client is provisional at this point — the deal form creates the draft before it
        // has asked anything about the owning entity. Both fields may be null; admin/AMLCo
        // establishes the real client during the ownership-structure review.
        Client client = new Client();
        ClientInput ci = req.client();
        if (ci != null) {
            client.setDisplayName(blankToNull(ci.displayName()));
            client.setClientType(ci.clientType());
            client.setEmail(blankToNull(ci.email()));
            client.setPhone(blankToNull(ci.phone()));
        }
        Client savedClient = clients.save(client);

        Deal d = new Deal();
        d.setFirmBranchId(branch.getId());
        d.setPropertyId(savedProp.getId());
        d.setClientId(savedClient.getId());
        d.setStatus(DealStatus.NEW);
        d.setTransactionType(req.transactionType());
        d.setTransactionValue(req.transactionValue());
        d.setPocName(orFallback(req.pocName(), branch.getManagerName()));
        d.setPocRole(req.pocRole());
        d.setPocPhone(orFallback(req.pocPhone(), branch.getPhone()));
        d.setPocEmail(orFallback(req.pocEmail(), branch.getEmail()));
        d.setNotes(req.notes());
        d.setTransactionPurpose(blankToNull(req.transactionPurpose()));
        d.setTrustInvolved(req.trustInvolved());
        d.setOnSoldQuickly(req.onSoldQuickly());
        d.setForeignExposureCountry(blankToNull(req.foreignExposureCountry()));
        d.setClientRemote(req.clientRemote());
        d.setRedFlagPresent(req.redFlagPresent());
        d.setValuationMin(req.valuationMin());
        d.setValuationMax(req.valuationMax());
        d.setCreatedByUserId(actor.id());
        applyRiskRating(d);
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
        if (req.transactionValue() != null) d.setTransactionValue(req.transactionValue());
        if (req.pocName() != null) d.setPocName(blankToNull(req.pocName()));
        if (req.pocRole() != null) d.setPocRole(blankToNull(req.pocRole()));
        if (req.pocPhone() != null) d.setPocPhone(blankToNull(req.pocPhone()));
        if (req.pocEmail() != null) d.setPocEmail(blankToNull(req.pocEmail()));
        if (req.notes() != null) d.setNotes(blankToNull(req.notes()));
        if (req.transactionPurpose() != null) d.setTransactionPurpose(blankToNull(req.transactionPurpose()));
        if (req.trustInvolved() != null) d.setTrustInvolved(req.trustInvolved());
        if (req.onSoldQuickly() != null) d.setOnSoldQuickly(req.onSoldQuickly());
        if (req.foreignExposureCountry() != null) {
            d.setForeignExposureCountry(blankToNull(req.foreignExposureCountry()));
        }
        if (req.clientRemote() != null) d.setClientRemote(req.clientRemote());
        if (req.redFlagPresent() != null) d.setRedFlagPresent(req.redFlagPresent());
        if (req.valuationMin() != null) d.setValuationMin(req.valuationMin());
        if (req.valuationMax() != null) d.setValuationMax(req.valuationMax());
        // Against the merged state, not the request — a PATCH carrying only one bound must
        // still be checked against the bound already stored.
        validateValuationRange(d.getValuationMin(), d.getValuationMax());
        applyRiskRating(d);
        return d;
    }

    @Transactional
    public Property updateProperty(Long dealId, PropertyInput input) {
        Deal d = mustFindEditable(dealId);
        Property p = properties.findById(d.getPropertyId())
                .orElseThrow(() -> new NotFoundException("Property not found"));
        applyPropertyInput(p, input); // idempotent to allow partial updates
        // Re-asserted on every write, not just at creation: the branch can move, and the country
        // is the reporting entity's answer rather than a value the property carries on its own.
        p.setCountry(firmCountryOf(d));
        return p;
    }

    @Transactional
    public Client updateClient(Long dealId, ClientInput input) {
        Deal d = mustFindEditable(dealId);
        Client c = clients.findById(d.getClientId())
                .orElseThrow(() -> new NotFoundException("Client not found"));
        // Null-guarded like applyPropertyInput, so the deal form can patch the client's name
        // as soon as it knows it without blanking the contact details it hasn't asked for yet.
        if (input == null) return c;
        if (input.displayName() != null) c.setDisplayName(blankToNull(input.displayName()));
        if (input.clientType() != null) c.setClientType(input.clientType());
        if (input.email() != null) c.setEmail(blankToNull(input.email()));
        if (input.phone() != null) c.setPhone(blankToNull(input.phone()));
        return c;
    }

    /**
     * Deletes are restricted to ROOT (global) and SENIOR_MANAGER (within their own firm) — the
     * @PreAuthorize on the controller gates the role; here we enforce the firm scope.
     */
    @Transactional
    public void delete(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        assertCanDelete(d);
        Long propertyId = d.getPropertyId();
        Long clientId = d.getClientId();

        // Before the deal row goes. deal_beneficial_owner cascades with it, so afterwards there
        // is no way to tell which people this deal held — and any left on no other deal would
        // linger as identity records nothing can reach.
        beneficialOwners.releaseFromDeal(d.getId());

        deals.delete(d);
        // Property and client are 1-1 with deal, so safe to clean up.
        properties.deleteById(propertyId);
        clients.deleteById(clientId);
    }

    private void assertCanDelete(Deal d) {
        UserPrincipal actor = currentPrincipal();
        if (actor.role() == Role.ROOT) {
            return;
        }
        // A broker discarding their own deal before handing it over. The deal form persists a
        // deal partway through so documents have something to attach to, so without this the
        // "Discard" button would leave an orphan the author has no way to clear.
        if (DealLifecycleService.isDealAuthor(actor.role())
                && actor.id().equals(d.getCreatedByUserId())
                && d.getStatus() == DealStatus.NEW) {
            return;
        }
        if (actor.role() == Role.SENIOR_MANAGER) {
            FirmBranch branch = branches.findById(d.getFirmBranchId()).orElse(null);
            Long dealFirmId = branch == null ? null : branch.getRealEstateFirmId();
            if (dealFirmId == null || !dealFirmId.equals(actor.realEstateFirmId())) {
                throw new ForbiddenException("You can only delete deals within your own firm");
            }
            return;
        }
        throw new ForbiddenException("Only ROOT or a senior manager may delete a deal");
    }

    /**
     * Runs a lifecycle verb and records its note on the deal's timeline.
     *
     * <p>One method behind all six endpoints — the rules live in {@link DealLifecycleService},
     * so this only has to resolve the deal's firm (for the scope check) and append the note.
     */
    @Transactional
    public TransitionResult act(Long id, DealAction action, String note) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        DealStatus previous = lifecycle.transition(d, actor, action, firmIdOf(d), note);
        dealNotes.appendTransition(d, actor, note, previous, d.getStatus());
        return new TransitionResult(d, previous);
    }

    /** Adds a free comment to the deal's timeline. Readable deal, writable comment. */
    @Transactional
    public Deal comment(Long id, String body) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        lifecycle.assertCanRead(d, actor, firmIdOf(d));
        dealNotes.appendComment(d, actor, body);
        return d;
    }

    /** The whole notes timeline for a deal the caller is allowed to read. */
    @Transactional(readOnly = true)
    public List<DealNoteDto> notes(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertCanRead(d, currentPrincipal(), firmIdOf(d));
        return dealNotes.timeline(d);
    }

    /** Returns a pair of (deal, previousStatus) so the controller can audit the transition. */
    @Transactional
    public OverrideResult override(Long id, DealStatus target, String reason) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        DealStatus previous = lifecycle.override(d, currentPrincipal(), target, firmIdOf(d), reason);
        dealNotes.appendTransition(d, currentPrincipal(), reason, previous, d.getStatus());
        return new OverrideResult(d, previous);
    }

    public record TransitionResult(Deal deal, DealStatus previousStatus) {}

    public record OverrideResult(Deal deal, DealStatus previousStatus) {}

    /* ---------- helpers ---------- */

    private Deal mustFindEditable(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertEditable(d, currentPrincipal(), firmIdOf(d));
        return d;
    }

    /**
     * The reporting entity a deal belongs to, via its branch.
     *
     * <p>Every lifecycle check needs it. The version this replaces checked only the actor's role
     * on the decision paths, which let a compliance officer of one firm act on another's deals.
     */
    private Long firmIdOf(Deal d) {
        FirmBranch b = branches.findById(d.getFirmBranchId()).orElse(null);
        return b == null ? null : b.getRealEstateFirmId();
    }

    private String firmCountryOf(Deal d) {
        FirmBranch b = branches.findById(d.getFirmBranchId()).orElse(null);
        return b == null ? null : firmCountryOf(b);
    }

    private String firmCountryOf(FirmBranch branch) {
        return firms.findById(branch.getRealEstateFirmId())
                .map(RealEstateFirm::getCountry)
                .orElseThrow(() -> new BadRequestException(
                        "Branch " + branch.getId() + " has no reporting entity"));
    }

    private void applyPropertyInput(Property p, PropertyInput input) {
        if (input == null) return;
        if (input.addressLine1() != null) p.setAddressLine1(input.addressLine1());
        if (input.addressLine2() != null) p.setAddressLine2(input.addressLine2());
        if (input.suburb() != null) p.setSuburb(input.suburb());
        if (input.district() != null) p.setDistrict(input.district());
        if (input.region() != null) p.setRegion(input.region());
        if (input.postcode() != null) p.setPostcode(input.postcode());
        if (input.titleReference() != null) p.setTitleReference(input.titleReference());
        if (input.legalDescription() != null) p.setLegalDescription(input.legalDescription());
        if (input.landAreaSqm() != null) p.setLandAreaSqm(input.landAreaSqm());
        if (input.propertyType() != null) p.setPropertyType(input.propertyType());
        if (input.reasonForSelling() != null) p.setReasonForSelling(blankToNull(input.reasonForSelling()));
    }

    /** "" means "clear this field"; null means "leave it alone". */
    private static String blankToNull(String v) {
        return (v == null || v.isBlank()) ? null : v;
    }

    private static void validateValuationRange(BigDecimal min, BigDecimal max) {
        if (min == null || max == null) return;
        if (max.compareTo(min) < 0) {
            throw new BadRequestException("Maximum property value cannot be below the minimum");
        }
    }

    /**
     * The deal's risk position.
     *
     * <p>The rule itself moved to {@link DealRiskService} in V35, when an ownership node's
     * answers began to feed it: two call sites here are no longer the only ways a rating can
     * change, and a rule with two homes would eventually disagree with itself.
     */
    private void applyRiskRating(Deal d) {
        risk.apply(d);
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
