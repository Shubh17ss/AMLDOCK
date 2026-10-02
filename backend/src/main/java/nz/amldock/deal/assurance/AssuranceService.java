package nz.amldock.deal.assurance;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealService;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.assurance.dto.AssuranceDealDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.version.DealVersion;
import nz.amldock.deal.version.DealVersionRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * The assurance register: compliance's second look at deals it has already signed off.
 *
 * <p>Only VERIFIED and CLOSED deals are listed. A deal reopened into review has a sign-off that is
 * being worked past, and assuring it mid-change would be assuring something about to stop being
 * true.
 *
 * <p>The mark lives on the version, not the deal, because a sign-off is per version. Only the
 * current position is kept; each change also goes to the audit log.
 */
@Service
public class AssuranceService {

    /** The statuses a deal has to be in for its versions to be assured. */
    private static final List<DealStatus> ASSURABLE = List.of(DealStatus.VERIFIED, DealStatus.CLOSED);

    private final DealService dealService;
    private final DealRepository deals;
    private final DealVersionRepository versions;
    private final DealLifecycleService lifecycle;
    private final FirmBranchRepository branches;
    private final UserRepository users;
    private final AuditService audit;

    public AssuranceService(DealService dealService, DealRepository deals, DealVersionRepository versions,
                            DealLifecycleService lifecycle, FirmBranchRepository branches,
                            UserRepository users, AuditService audit) {
        this.dealService = dealService;
        this.deals = deals;
        this.versions = versions;
        this.lifecycle = lifecycle;
        this.branches = branches;
        this.users = users;
        this.audit = audit;
    }

    /**
     * Every verified or closed deal the caller may read, each with its versions newest first.
     *
     * <p>Scoped by {@link DealService#list}, so the firm and branch rules are the deals list's own
     * rather than a second copy of them. Deals are ordered by their latest sign-off, newest first.
     */
    @Transactional(readOnly = true)
    public List<AssuranceDealDto> list(Long firmId, Long branchId) {
        List<DealListItemDto> rows = ASSURABLE.stream()
                .flatMap(s -> dealService.list(s, firmId, branchId).stream())
                .toList();
        if (rows.isEmpty()) return List.of();

        Map<Long, List<DealVersion>> byDeal = versions
                .findAllByDealIdInOrderByVersionNoDesc(rows.stream().map(DealListItemDto::id).toList())
                .stream()
                .collect(Collectors.groupingBy(DealVersion::getDealId));

        Map<Long, User> people = usersById(byDeal.values().stream()
                .flatMap(List::stream)
                .flatMap(v -> Stream.of(v.getVerifiedByUserId(), v.getAssuranceByUserId())));

        List<AssuranceDealDto> out = new ArrayList<>();
        for (DealListItemDto d : rows) {
            List<AssuranceVersionDto> vs = byDeal.getOrDefault(d.id(), List.of()).stream()
                    .map(v -> toDto(v, people))
                    .toList();
            out.add(new AssuranceDealDto(d, vs));
        }
        // Latest sign-off first. A deal with no versions (verified before versions existed) has
        // nothing to assure, and sorts last rather than disappearing without explanation.
        out.sort(Comparator.comparing(
                (AssuranceDealDto a) -> a.versions().isEmpty() ? null : a.versions().get(0).verifiedAt(),
                Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    /**
     * Marks one version ASSURED or UNASSURED.
     *
     * <p>Only as a real change of position: assuring needs a version that is not reviewed or
     * unassured, and unassuring needs one that is assured. Marking the same thing twice would
     * replace the note and the byline with no change in the verdict behind them.
     */
    @Transactional
    public AssuranceVersionDto mark(Long dealId, Integer versionNo, AssuranceStatus target, String note) {
        Deal d = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        UserPrincipal actor = currentPrincipal();
        lifecycle.assertCanRead(d, actor, firmIdOf(d));
        // The controller's @PreAuthorize says the same; this one is scoped to the deal's firm.
        if (!DealLifecycleService.isDecider(actor.role())) {
            throw new ForbiddenException("Only compliance may assure a deal");
        }
        if (!ASSURABLE.contains(d.getStatus())) {
            throw new BadRequestException("Only a verified or closed deal can be assured");
        }

        DealVersion v = versions.findByDealIdAndVersionNo(dealId, versionNo)
                .orElseThrow(() -> new NotFoundException(
                        "Version " + versionNo + " of deal " + dealId + " not found"));

        AssuranceStatus current = v.getAssuranceStatus();
        if (target == AssuranceStatus.ASSURED && current == AssuranceStatus.ASSURED) {
            throw new BadRequestException("This version is already assured");
        }
        if (target == AssuranceStatus.UNASSURED && current != AssuranceStatus.ASSURED) {
            throw new BadRequestException("Only an assured version can be marked unassured");
        }

        String body = note == null ? "" : note.trim();
        if (body.length() < 3) {
            throw new BadRequestException("A note of at least 3 characters is required");
        }

        v.markAssurance(target, body, actor.id(), Instant.now());
        versions.save(v);

        boolean assured = target == AssuranceStatus.ASSURED;
        audit.record(assured ? AuditAction.DEAL_VERSION_ASSURED : AuditAction.DEAL_VERSION_UNASSURED,
                "Deal", d.getId(),
                "Version " + versionNo + " of deal " + d.getReference() + " marked "
                        + (assured ? "assured" : "unassured") + ": " + body);

        return toDto(v, usersById(Stream.of(v.getVerifiedByUserId(), actor.id())));
    }

    private Map<Long, User> usersById(Stream<Long> ids) {
        return users.findAllById(ids.filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static AssuranceVersionDto toDto(DealVersion v, Map<Long, User> people) {
        return new AssuranceVersionDto(
                v.getVersionNo(),
                nameOf(people.get(v.getVerifiedByUserId())),
                v.getVerifiedAt(),
                v.getVerifyNote(),
                v.getReopenedAt(),
                v.getAssuranceStatus(),
                v.getAssuranceNote(),
                nameOf(people.get(v.getAssuranceByUserId())),
                v.getAssuranceAt());
    }

    /** Null for a user who has since been deleted: a byline outlives the account behind it. */
    private static String nameOf(User u) {
        return u == null ? null : u.getFullName();
    }

    private Long firmIdOf(Deal d) {
        FirmBranch b = branches.findById(d.getFirmBranchId()).orElse(null);
        return b == null ? null : b.getRealEstateFirmId();
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
