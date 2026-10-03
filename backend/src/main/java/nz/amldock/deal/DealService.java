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
import nz.amldock.deal.dto.RiskAssessmentDto;
import nz.amldock.deal.version.DealVersionService;
import nz.amldock.deal.readiness.Readiness;
import nz.amldock.deal.monitoring.TransactionMonitoringService;
import nz.amldock.deal.monitoring.dto.StatusMoveDto;
import nz.amldock.deal.readiness.VerificationReadinessService;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.deal.DealRiskService.RiskAssessment;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.dealnote.dto.DealNoteDto;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.notification.DealNotificationEnqueuer;
import nz.amldock.property.Property;
import nz.amldock.deal.dto.CloseDealRequest;
import nz.amldock.deal.dto.SaleDto;
import nz.amldock.deal.sale.DealSaleUnit;
import nz.amldock.deal.sale.DealSaleUnitRepository;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.PropertyType;
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
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
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
    private final OwnershipService ownership;
    private final AuditService audit;
    private final DealNotificationEnqueuer notifier;
    private final DealVersionService versions;
    private final DealSaleUnitRepository saleUnits;
    private final VerificationReadinessService readiness;
    private final TransactionMonitoringService monitoring;

    public DealService(DealRepository deals,
                       PropertyRepository properties,
                       ClientRepository clients,
                       FirmBranchRepository branches,
                       RealEstateFirmRepository firms,
                       UserRepository users,
                       DealLifecycleService lifecycle,
                       DealNoteService dealNotes,
                       BeneficialOwnerService beneficialOwners,
                       DealRiskService risk,
                       OwnershipService ownership,
                       AuditService audit,
                       DealNotificationEnqueuer notifier,
                       DealVersionService versions,
                       DealSaleUnitRepository saleUnits,
                       VerificationReadinessService readiness,
                       TransactionMonitoringService monitoring) {
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
        this.ownership = ownership;
        this.audit = audit;
        this.notifier = notifier;
        this.versions = versions;
        this.saleUnits = saleUnits;
        this.readiness = readiness;
        this.monitoring = monitoring;
    }

    /* ---------- queries ---------- */

    /**
     * Every deal the caller may read, narrowed by their role.
     *
     * <p>The requested firm and branch are <em>overwritten</em> by whatever the actor's own role
     * pins, not merely intersected with it — an agent asking for a branch still gets only their own
     * deals. This is the set-level twin of {@link DealLifecycleService#assertCanRead}: use that one
     * for a single deal, this one for a list, because asserting per row would throw on the first
     * deal outside the caller's scope instead of leaving it out.
     *
     * <p>Shared with the individuals register, which reaches people through their deals and so
     * inherits exactly this rule. A second transcription of it would be a second thing to keep
     * right.
     *
     * <p>A switch with no default, so a new role fails to compile here rather than defaulting into
     * whichever branch happens to be last.
     */
    @Transactional(readOnly = true)
    public List<Deal> readableDeals(DealStatus status, Long firmIdFilter, Long branchIdFilter) {
        UserPrincipal actor = currentPrincipal();

        Long effectiveCreator = null;
        Long effectiveFirm = firmIdFilter;
        Long effectiveBranch = branchIdFilter;
        switch (actor.role()) {
            // Their own deals plus any they have been added to — DealRepository.search reads
            // this id both ways.
            case AGENT, AGENT_PA -> effectiveCreator = actor.id();
            case ADMIN, SALES_MANAGER -> effectiveBranch = actor.firmBranchId();
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> effectiveFirm = actor.realEstateFirmId();
            // Both see every firm, so the caller's filters stand as given.
            case ROOT, AUDIT -> { /* honour passed filters verbatim */ }
            // Finance works in the fund register, not the CDD workspace. Stated rather than
            // left to fall through this switch, which would have handed over every deal.
            case FINANCE -> throw new ForbiddenException("Deals are outside the finance role");
        }

        return deals.search(status, effectiveCreator, effectiveFirm, effectiveBranch);
    }

    @Transactional(readOnly = true)
    public List<DealListItemDto> list(DealStatus status, Long firmIdFilter, Long branchIdFilter) {
        List<Deal> results = readableDeals(status, firmIdFilter, branchIdFilter);
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
                    p == null ? null : p.getPropertyType(),
                    u == null ? null : u.getEmail(),
                    u == null ? null : u.getFullName());
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
        if (!DealLifecycleService.canCreateDeal(actor.role())) {
            throw new BadRequestException("This role may not create deals");
        }
        // Branch-level staff create on the branch they're assigned to, so the request needn't
        // name it — the deal form omits it for them entirely. Firm-level staff have no branch of
        // their own, so for them the form asks and the value is required here.
        Long branchId = req.firmBranchId() == null ? actor.firmBranchId() : req.firmBranchId();
        if (branchId == null) {
            throw new BadRequestException("Choose the branch this deal belongs to");
        }
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));
        if (!branch.isActive()) {
            throw new BadRequestException("Branch is inactive");
        }
        if (actor.firmBranchId() != null) {
            // Assigned to a branch: that branch and no other, whatever the request asked for.
            if (!actor.firmBranchId().equals(branch.getId())) {
                throw new ForbiddenException("You can only create deals on your assigned branch");
            }
        } else if (actor.realEstateFirmId() == null
                || !actor.realEstateFirmId().equals(branch.getRealEstateFirmId())) {
            // Firm-level: any branch of their own reporting entity, and nobody else's.
            throw new ForbiddenException("You can only create deals within your own firm");
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
        applyTenure(d, req.ownershipTenureTbc(), req.ownershipTenureYears(), req.ownershipTenureMonths());
        d.setFaceToFaceIdVerified(req.faceToFaceIdVerified());
        d.setForeignExposureCountry(blankToNull(req.foreignExposureCountry()));
        d.setClientRemote(req.clientRemote());
        d.setRedFlagPresent(req.redFlagPresent());
        d.setRedFlag(redFlagFor(req.redFlagPresent(), req.redFlag()));
        d.setValuationMin(req.valuationMin());
        d.setValuationMax(req.valuationMax());
        d.setCreatedByUserId(actor.id());
        applyRiskRating(d);
        Deal saved = deals.save(d);

        // Generate human reference now that we have an id
        int year = OffsetDateTime.now(ZoneOffset.UTC).getYear();
        saved.setReference(String.format("DEAL-%d-%04d", year, saved.getId()));

        // Rarely reached from the form, which creates the deal at the end of section 2 and only
        // asks about trusts in section 3 — but POST /deals accepts the field, so an API client
        // can answer it here. Leaving it out would make the rule depend on which door you came in.
        if (Boolean.TRUE.equals(req.trustInvolved())) recordImpliedTrust(saved.getId());

        // Inside this transaction on purpose, and after setReference above: the reference needs the
        // generated id, and the payload snapshot would otherwise capture a null. See
        // DealNotificationEnqueuer for why the outbox row must commit with the deal.
        notifier.enqueueDealCreated(saved, actor);
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
        // Against the stored value, and before the setter: the create form autosaves on every
        // section move, so this PATCH re-sends trustInvolved: true many times per deal. Only the
        // edge from "not asked" or "no" implies a node; a repeat of the same answer implies
        // nothing. Three-state field — null means not asked — hence Boolean.TRUE.equals.
        boolean trustJustAdded = Boolean.TRUE.equals(req.trustInvolved())
                && !Boolean.TRUE.equals(d.getTrustInvolved());
        if (req.trustInvolved() != null) d.setTrustInvolved(req.trustInvolved());
        applyTenure(d, req.ownershipTenureTbc(), req.ownershipTenureYears(), req.ownershipTenureMonths());
        if (req.faceToFaceIdVerified() != null) d.setFaceToFaceIdVerified(req.faceToFaceIdVerified());
        if (req.keyContactNodeId() != null) d.setKeyContactNodeId(req.keyContactNodeId());
        if (req.foreignExposureCountry() != null) {
            d.setForeignExposureCountry(blankToNull(req.foreignExposureCountry()));
        }
        if (req.clientRemote() != null) d.setClientRemote(req.clientRemote());
        if (req.redFlagPresent() != null) d.setRedFlagPresent(req.redFlagPresent());
        if (req.redFlag() != null) d.setRedFlag(blankToNull(req.redFlag()));
        // "No red flag" and "this red flag" cannot both be true. Answering the boolean No clears
        // whichever flag was named before it, so the pair can never contradict itself on the
        // record — checked against the merged state, since either half may arrive alone.
        if (Boolean.FALSE.equals(d.getRedFlagPresent())) d.setRedFlag(null);
        if (req.valuationMin() != null) d.setValuationMin(req.valuationMin());
        if (req.valuationMax() != null) d.setValuationMax(req.valuationMax());
        // Against the merged state, not the request — a PATCH carrying only one bound must
        // still be checked against the bound already stored.
        validateValuationRange(d.getValuationMin(), d.getValuationMax());
        applyRiskRating(d);
        if (trustJustAdded) recordImpliedTrust(d.getId());
        return d;
    }

    /**
     * Puts the trust the deal just declared onto its ownership structure.
     *
     * <p>Audited here rather than inside OwnershipService: that whole package records from its
     * controller, and this node has no controller behind it. The deal package already audits a
     * derived change from the service that derives it — see DealRiskService recording
     * DEAL_RISK_CHANGED — and an implied node is the same kind of event. A node appearing in an
     * AML file with no trail is worse than one a person put there.
     */
    private void recordImpliedTrust(Long dealId) {
        OwnershipNode node = ownership.attachImpliedTrust(dealId);
        if (node == null) return;   // the deal already had a trust on it
        audit.record(AuditAction.NODE_CREATED, "OwnershipNode", node.getId(),
                "Added TRUST node \"" + node.getDisplayName() + "\" to deal " + dealId
                        + " because the deal answered yes to a trust in the beneficial ownership");
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
        // The two firm-level deciders, together: the rule is the same for both, and writing it
        // twice is how the compliance officer's copy would later drift from the manager's.
        // Scoped to their own firm because that is exactly what readableDeals shows them — this
        // lets them delete what they can see, and nothing else.
        if (actor.role() == Role.SENIOR_MANAGER || actor.role() == Role.AML_COMPLIANCE_OFFICER) {
            FirmBranch branch = branches.findById(d.getFirmBranchId()).orElse(null);
            Long dealFirmId = branch == null ? null : branch.getRealEstateFirmId();
            if (dealFirmId == null || !dealFirmId.equals(actor.realEstateFirmId())) {
                throw new ForbiddenException("You can only delete deals within your own firm");
            }
            return;
        }
        throw new ForbiddenException(
                "Only ROOT, a compliance officer or a senior manager may delete a deal");
    }

    /**
     * Runs a lifecycle verb and records its note on the deal's timeline.
     *
     * <p>One method behind all seven endpoints — the rules live in {@link DealLifecycleService},
     * so this only has to resolve the deal's firm (for the scope check) and append the note.
     *
     * <p>The two version calls are the price of REOPEN existing at all. Verifying has to freeze the
     * deal before anything can move it again, and reopening has to say on the version it is leaving
     * who took it back and why. Both run inside this transaction: a deal that reached VERIFIED
     * without its snapshot would be a sign-off pointing at nothing.
     */
    @Transactional
    public TransitionResult act(Long id, DealAction action, String note) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        DealStatus previous = lifecycle.transition(d, actor, action, firmIdOf(d), note);
        // After the transition's own checks, so a caller who may not verify at all is told that
        // rather than handed the deal's gaps. Throwing here rolls the status change back.
        if (action == DealAction.VERIFY) readiness.assertReady(d);
        if (action == DealAction.REOPEN) versions.recordReopen(d, actor, note);
        // Close is recorded by closeWithSale, once the sale it closed at is known.
        if (action == DealAction.UNCLOSE) monitoring.recordUnclose(d, actor.id(), note);
        versions.snapshotIfVerified(d, actor, note, previous);
        dealNotes.appendTransition(d, actor, note, previous, d.getStatus());
        notifier.enqueueStatusChanged(d, actor, previous);
        return new TransitionResult(d, previous);
    }

    /**
     * Closes a deal and records what it finished as.
     *
     * <p>One transaction for both halves on purpose. A deal that reached CLOSED without its sale
     * detail is the gap this feature exists to close, and a sale recorded against a deal that
     * failed to move would be an outcome for something still running.
     *
     * <p>The answers are validated <em>before</em> the transition, so a rejected payload leaves
     * the deal exactly where it was rather than closing it and then refusing the figures.
     *
     * <p>Re-closing overwrites: the scalar answers are reassigned and the unit rows are replaced
     * wholesale. That is what makes {@code UNCLOSE} worth having — it is the way back to correct
     * a closure, and a correction that appended to the old figures would be neither.
     */
    @Transactional
    public TransitionResult closeWithSale(Long id, CloseDealRequest req) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        // The deal's own property type decides which shape of answer is legal, never the request.
        // A caller that could choose its own rules could send one figure for a development and
        // skip the per-unit breakdown that is the whole reason developments are asked differently.
        boolean development = propertyTypeOf(d) == PropertyType.DEVELOPMENT;
        List<CloseDealRequest.SaleUnitInput> units = validateSale(req, development);

        TransitionResult result = act(id, DealAction.CLOSE, null);

        d.setPropertySold(req.propertySold());
        d.setSalePrice(development || !req.propertySold() ? null : req.salePrice());

        saleUnits.deleteAllByDealId(id);
        // Flushed before the inserts: delete-then-insert in one transaction otherwise leaves
        // Hibernate free to order the statements the other way round.
        saleUnits.flush();
        if (!units.isEmpty()) {
            List<DealSaleUnit> rows = new ArrayList<>();
            for (int i = 0; i < units.size(); i++) {
                rows.add(new DealSaleUnit(id, units.get(i).unitName().trim(),
                        units.get(i).salePrice(), i));
            }
            saleUnits.saveAll(rows);
        }

        // The figure the variance rule reads: the sale price, or a development's unit total.
        BigDecimal total = units.isEmpty() ? d.getSalePrice()
                : units.stream().map(CloseDealRequest.SaleUnitInput::salePrice)
                        .filter(java.util.Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        monitoring.recordClose(d, currentPrincipal().id(), req.note(), req.propertySold(), total);
        return result;
    }

    /**
     * The sale answers, or an empty one for a deal that has never been closed.
     *
     * <p>Readable by anyone who may read the deal — this says what happened to the file, not who
     * decided it, and the tab showing it sits beside the rest of the deal.
     */
    @Transactional(readOnly = true)
    public SaleDto sale(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertCanRead(d, currentPrincipal(), firmIdOf(d));

        List<SaleDto.SaleUnitDto> units = saleUnits.findAllByDealIdOrderBySortOrderAsc(id).stream()
                .map((u) -> new SaleDto.SaleUnitDto(u.getId(), u.getUnitName(), u.getSalePrice()))
                .toList();

        // Summed here rather than stored, so a total can never disagree with the rows under it.
        BigDecimal total = units.isEmpty()
                ? d.getSalePrice()
                : units.stream().map(SaleDto.SaleUnitDto::salePrice)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new SaleDto(d.getPropertySold(), d.getSalePrice(), total, units);
    }

    /**
     * Checks the answers against the property they are about, and hands back the units to write.
     *
     * <p>Every rule here is one the close dialog also enforces by disabling its button. That is
     * deliberate duplication: the dialog makes the rule visible before it is broken, and this
     * makes it true for every caller, including one that never opened the dialog.
     */
    private List<CloseDealRequest.SaleUnitInput> validateSale(CloseDealRequest req, boolean development) {
        List<CloseDealRequest.SaleUnitInput> units = req.units() == null ? List.of() : req.units();

        if (!req.propertySold()) {
            if (req.salePrice() != null || !units.isEmpty()) {
                throw new BadRequestException(
                        "A property that did not sell cannot carry a sale price");
            }
            return List.of();
        }

        if (development) {
            if (req.salePrice() != null) {
                throw new BadRequestException(
                        "A development records a price per unit, not a single sale price");
            }
            if (units.isEmpty()) {
                throw new BadRequestException("Add at least one unit and what it sold for");
            }
            for (CloseDealRequest.SaleUnitInput u : units) {
                if (u.unitName() == null || u.unitName().isBlank()) {
                    throw new BadRequestException("Every unit needs a name");
                }
                if (u.salePrice() == null) {
                    throw new BadRequestException(
                            "Every unit needs the price it sold for: " + u.unitName().trim());
                }
            }
            return units;
        }

        if (!units.isEmpty()) {
            throw new BadRequestException("Only a development is sold as units");
        }
        if (req.salePrice() == null) {
            throw new BadRequestException("Enter what the property sold for");
        }
        return List.of();
    }

    /** The deal's property type, or null when it has no property or none was chosen. */
    private PropertyType propertyTypeOf(Deal d) {
        if (d.getPropertyId() == null) return null;
        return properties.findById(d.getPropertyId()).map(Property::getPropertyType).orElse(null);
    }

    /**
     * Adds a free comment to the deal's timeline. Readable deal, writable comment — while the deal
     * is still being worked. A verified or closed deal is a finished file, and a note added to it
     * afterwards would read as part of what was signed off.
     */
    @Transactional
    public Deal comment(Long id, String body) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        lifecycle.assertCanRead(d, actor, firmIdOf(d));
        if (d.getStatus() == DealStatus.VERIFIED || d.getStatus() == DealStatus.CLOSED) {
            throw new BadRequestException("Notes can't be added to a verified or closed deal");
        }
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

    /** The deal's moves between VERIFIED and CLOSED, newest first, for a deal the caller may read. */
    @Transactional(readOnly = true)
    public List<StatusMoveDto> transactionMonitoring(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertCanRead(d, currentPrincipal(), firmIdOf(d));
        return monitoring.history(id);
    }

    /** Whether the deal could be verified now, and what is still missing if not. */
    @Transactional(readOnly = true)
    public Readiness verificationReadiness(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertCanRead(d, currentPrincipal(), firmIdOf(d));
        return readiness.assess(d);
    }

    /* ---------- the risk position ---------- */

    /**
     * The deal's risk score, its band, and the workings behind both.
     *
     * <p>Readable by anyone who may read the deal, including the auditor. The workings are the
     * part worth showing widely: a rating nobody outside compliance can account for is the
     * problem this replaced.
     */
    @Transactional(readOnly = true)
    public RiskAssessmentDto risk(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        lifecycle.assertCanRead(d, currentPrincipal(), firmIdOf(d));
        return riskDto(d);
    }

    /**
     * Signs off the deal's current risk position.
     *
     * <p>Refused while anything that feeds the score is unanswered. An approval given over a
     * half-answered file is a sign-off on a number that was never computed from a complete set of
     * facts, and nothing downstream could tell the two apart afterwards.
     *
     * <p>Not gated on the deal being editable. Approving a risk is a compliance act on a deal
     * under review, which is precisely when the deal itself is closed to content changes.
     */
    @Transactional
    public RiskAssessmentDto approveRisk(Long id) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        UserPrincipal actor = mustBeDecider(d);

        RiskAssessment assessment = risk.assess(d);
        if (!assessment.complete()) {
            throw new BadRequestException("Answer every question that affects the risk first — "
                    + assessment.unanswered().size() + " still outstanding");
        }
        if (d.isRiskApproved()) return riskDto(d);

        d.setRiskApproved(true);
        d.setRiskApprovedByUserId(actor.id());
        d.setRiskApprovedAt(Instant.now());

        audit.record(AuditAction.DEAL_RISK_APPROVED, "Deal", d.getId(),
                "Risk " + d.getRiskRating() + " (score " + d.getRiskValue() + ") approved on deal "
                        + d.getReference());
        return riskDto(d);
    }

    /**
     * Manually overrides the deal's risk band.
     *
     * <p>An override is an override whatever band it names, <em>including the one the engine
     * already arrived at</em>. A reviewer who pins a deal to the calculated band is agreeing with
     * it deliberately, on the record, with a reason; treating that as a withdrawal — flipping
     * back to DERIVED and deleting the comment, the author and the timestamp — would leave the
     * file saying nobody ever made a decision. The intent is identical either way and only the
     * value differs, which is not what makes something an override.
     *
     * <p>The consequence is that DERIVED is a one-way door: once a deal has been overridden its
     * band stops tracking the score, which keeps moving underneath and is still shown beside it.
     * A reviewer can set any band they like, so nothing is unreachable; what is gone is going
     * back to following the rules automatically. That is deliberate — a human determination
     * stands until a human revisits it.
     *
     * <p>The approval is withdrawn either way. The reviewer approving a rating and the reviewer
     * changing it are not necessarily the same person, and a sign-off does not carry across to a
     * band nobody signed off.
     */
    @Transactional
    public RiskAssessmentDto overrideRisk(Long id, RiskRating rating, String comment) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        UserPrincipal actor = mustBeDecider(d);

        RiskAssessment assessment = risk.assess(d);
        RiskRating previous = d.getRiskRating();

        d.setRiskValue(assessment.value());
        d.setRiskRating(rating);
        d.setRiskRatingSource(RiskRatingSource.OVERRIDE);
        // The comment and its byline stand or fall together, and here they always stand: they
        // are the record of a decision somebody took, and the decision happened whichever band
        // came out of it.
        d.setRiskOverrideComment(comment);
        d.setRiskOverriddenByUserId(actor.id());
        d.setRiskOverriddenAt(Instant.now());
        d.setRiskApproved(false);
        d.setRiskApprovedByUserId(null);
        d.setRiskApprovedAt(null);

        // Names both bands, so the line shows whether the reviewer was overruling the engine or
        // agreeing with it — the two look identical afterwards and only this says which it was.
        audit.record(AuditAction.DEAL_RISK_OVERRIDDEN, "Deal", d.getId(),
                "Risk manually overridden to " + rating + " (was " + previous + ") on deal "
                        + d.getReference() + ", against a calculated " + assessment.rating()
                        + " (score " + assessment.value() + "): " + comment);
        return riskDto(d);
    }

    /**
     * Whoever is asking has to be one of the two roles that decide a deal.
     *
     * <p>The controller's {@code @PreAuthorize} says the same thing, and this says it again
     * scoped to <em>this</em> deal's firm — the annotation cannot see which firm a deal belongs
     * to, so on its own it would let a compliance officer of one firm rate another's deals.
     */
    private UserPrincipal mustBeDecider(Deal d) {
        UserPrincipal actor = currentPrincipal();
        lifecycle.assertCanRead(d, actor, firmIdOf(d));
        if (!DealLifecycleService.isDecider(actor.role())) {
            throw new ForbiddenException("Only compliance may set a deal's risk level");
        }
        return actor;
    }

    private RiskAssessmentDto riskDto(Deal d) {
        return RiskAssessmentDto.of(d, risk.assess(d),
                nameOf(d.getRiskApprovedByUserId()), nameOf(d.getRiskOverriddenByUserId()));
    }

    /**
     * A user's name for a byline, or null.
     *
     * <p>The name rather than the email: a byline is read by a person asking who decided this,
     * and an address answers which account did it. The id travels on the DTO beside it for
     * anything that needs to identify the user rather than name them.
     *
     * <p>Null for a user who has since been deleted rather than an error: the record of who took
     * a decision outlives their account, and a deal must not fail to load because somebody left.
     */
    private String nameOf(Long userId) {
        return userId == null ? null
                : users.findById(userId).map(User::getFullName).orElse(null);
    }

    /** Returns a pair of (deal, previousStatus) so the controller can audit the transition. */
    @Transactional
    public OverrideResult override(Long id, DealStatus target, String reason) {
        Deal d = deals.findById(id).orElseThrow(() -> new NotFoundException("Deal " + id + " not found"));
        DealStatus previous = lifecycle.override(d, currentPrincipal(), target, firmIdOf(d), reason);
        // An override chooses where the deal goes, not what counts as a complete file: forcing it
        // into VERIFIED still needs everything verifying it the ordinary way would.
        if (target == DealStatus.VERIFIED) readiness.assertReady(d);
        // An override is still a way into VERIFIED, so it still owes a version. Leaving it out
        // would make the sign-off's completeness depend on which door compliance came through.
        if (previous == DealStatus.VERIFIED) versions.recordReopen(d, currentPrincipal(), reason);
        versions.snapshotIfVerified(d, currentPrincipal(), reason, previous);
        // Forced moves are moves too. A close by override records no sale outcome, because none
        // was asked; leaving CLOSED by any route is an unclose.
        if (previous == DealStatus.VERIFIED && target == DealStatus.CLOSED) {
            monitoring.recordClose(d, currentPrincipal().id(), reason, null, null);
        } else if (previous == DealStatus.CLOSED) {
            monitoring.recordUnclose(d, currentPrincipal().id(), reason);
        }
        dealNotes.appendTransition(d, currentPrincipal(), reason, previous, d.getStatus());
        notifier.enqueueStatusChanged(d, currentPrincipal(), previous);
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
    /**
     * Writes the tenure answer: either "to be confirmed" or a figure, never both (V51's
     * chk_deal_tenure_tbc). TBC clears the figure; a figure turns TBC off. Nulls leave the
     * stored answer alone, as everywhere else in the PATCH.
     */
    static void applyTenure(DealFields d, Boolean tbc, Integer years, Integer months) {
        if (Boolean.TRUE.equals(tbc)) {
            d.setOwnershipTenureTbc(true);
            d.setOwnershipTenureYears(null);
            d.setOwnershipTenureMonths(null);
            return;
        }
        if (years != null || months != null) {
            d.setOwnershipTenureTbc(false);
            // One box is a whole answer ("4 years"), so the other is cleared rather than kept
            // from an earlier figure.
            d.setOwnershipTenureYears(years);
            d.setOwnershipTenureMonths(months);
        } else if (Boolean.FALSE.equals(tbc)) {
            d.setOwnershipTenureTbc(false);
        }
    }

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

    /**
     * The named red flag, but only when the deal admits to having one.
     *
     * <p>Storing a flag against {@code redFlagPresent = false} would put a contradiction on the
     * compliance record, and the answer that carries weight is the boolean — so it wins.
     */
    private static String redFlagFor(Boolean present, String redFlag) {
        return Boolean.TRUE.equals(present) ? blankToNull(redFlag) : null;
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

    /** Public rather than private: the individuals register, in its own package, shows the same
     *  one-liner, and a second copy of "address, suburb, district, region" would be a second thing
     *  to keep in step. */
    public static String formatAddress(Property p) {
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
