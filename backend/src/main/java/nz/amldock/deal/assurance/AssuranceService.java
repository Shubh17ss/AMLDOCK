package nz.amldock.deal.assurance;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.PageResponse;
import nz.amldock.deal.DealListService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealScope;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.assurance.dto.AssuranceDealDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto.IssueDto;
import nz.amldock.deal.assurance.dto.UpdateAssuranceRequest;
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
 * <p>The verdict lives on the version, not the deal, because a sign-off is per version. It is
 * ASSURED (passed), ACTION_REQUIRED with the issues found and their planned remediation, or null
 * while nobody has reviewed it. Only the current verdict is kept; each change goes to the audit log.
 */
@Service
public class AssuranceService {

    /** The statuses a deal has to be in for its versions to be assured. */
    private static final List<DealStatus> ASSURABLE = List.of(DealStatus.VERIFIED, DealStatus.CLOSED);

    private final DealListService dealList;
    private final AssuranceQuery query;
    private final DealRepository deals;
    private final DealVersionRepository versions;
    private final AssuranceIssueRepository issues;
    private final DealLifecycleService lifecycle;
    private final FirmBranchRepository branches;
    private final UserRepository users;
    private final AuditService audit;

    public AssuranceService(DealListService dealList, AssuranceQuery query, DealRepository deals, DealVersionRepository versions,
                            AssuranceIssueRepository issues,
                            DealLifecycleService lifecycle, FirmBranchRepository branches,
                            UserRepository users, AuditService audit) {
        this.dealList = dealList;
        this.query = query;
        this.deals = deals;
        this.versions = versions;
        this.issues = issues;
        this.lifecycle = lifecycle;
        this.branches = branches;
        this.users = users;
        this.audit = audit;
    }

    /**
     * One page of the register: each verified or closed deal the caller may read, with its latest
     * version only. Older versions are history; they stay readable on the deal's version tab.
     *
     * <p>Scoped by {@link DealScope}, so the firm and branch rules are the deals list's own.
     *
     * <p>{@code from}/{@code to} keep a deal when its latest version was verified in the range, or
     * the deal was closed in the range: closing happens to the version the deal stands on. Either
     * bound may be null for an open-ended range. All of it runs in SQL ({@link AssuranceQuery}),
     * and only the page's rows are loaded and mapped.
     */
    @Transactional(readOnly = true)
    public PageResponse<AssuranceDealDto> list(AssuranceQuery.Filter filter, PageRequests paging) {
        DealScope scope = dealList.scopeForCurrentUser(filter.firmId(), filter.branchId());
        AssuranceQuery.RowPage page = query.page(scope, filter, paging);
        if (page.rows().isEmpty()) return PageResponse.of(List.of(), paging, page.total());

        List<DealListItemDto> dealRows = dealList.toListItems(
                dealList.loadInOrder(page.rows().stream().map(AssuranceQuery.Row::dealId).toList()));
        Map<Long, DealListItemDto> dealById = dealRows.stream()
                .collect(Collectors.toMap(DealListItemDto::id, Function.identity()));

        List<Long> versionIds = page.rows().stream().map(AssuranceQuery.Row::versionId).filter(Objects::nonNull).toList();
        Map<Long, DealVersion> versionById = versionIds.isEmpty() ? Map.of()
                : versions.findAllById(versionIds).stream().collect(Collectors.toMap(DealVersion::getId, Function.identity()));
        Map<Long, List<IssueDto>> issuesByVersion = versionIds.isEmpty() ? Map.of()
                : issues.findAllByDealVersionIdInOrderBySortOrderAsc(versionIds)
                        .stream()
                        .collect(Collectors.groupingBy(AssuranceIssue::getDealVersionId,
                                Collectors.mapping(i -> new IssueDto(i.getIssue(), i.getRemediation()),
                                        Collectors.toList())));
        Map<Long, User> people = usersById(versionById.values().stream()
                .flatMap(v -> Stream.of(v.getVerifiedByUserId(), v.getAssuranceByUserId())));

        List<AssuranceDealDto> out = new ArrayList<>();
        for (AssuranceQuery.Row row : page.rows()) {
            DealListItemDto deal = dealById.get(row.dealId());
            if (deal == null) continue;   // deleted between the id query and this load
            DealVersion v = row.versionId() == null ? null : versionById.get(row.versionId());
            out.add(new AssuranceDealDto(deal, v == null ? null
                    : toDto(v, people, issuesByVersion.getOrDefault(v.getId(), List.of()))));
        }
        return PageResponse.of(out, paging, page.total());
    }

    /**
     * Records the result of an assurance on one version.
     *
     * <p>ASSURED takes no issues and removes any recorded — passing a version is what clears its
     * findings. ACTION_REQUIRED needs at least one issue, and the list sent replaces the one
     * stored. Either verdict can follow either, so a version assured earlier can be marked as
     * needing action when something is found later.
     */
    @Transactional
    public AssuranceVersionDto update(Long dealId, Integer versionNo, UpdateAssuranceRequest req) {
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

        List<UpdateAssuranceRequest.Issue> sent = req.issues() == null ? List.of() : req.issues();
        List<IssueDto> cleaned = sent.stream()
                .map(i -> new IssueDto(trim(i.issue()), trim(i.remediation())))
                .toList();
        if (req.status() == AssuranceStatus.ASSURED && !cleaned.isEmpty()) {
            throw new BadRequestException("A passed assurance carries no issues");
        }
        if (req.status() == AssuranceStatus.ACTION_REQUIRED) {
            if (cleaned.isEmpty()) {
                throw new BadRequestException("Add at least one identified issue");
            }
            for (IssueDto i : cleaned) {
                if (i.issue().length() < 3 || i.remediation().length() < 3) {
                    throw new BadRequestException(
                            "Each issue and its remediation need at least 3 characters");
                }
            }
        }

        issues.deleteAllForVersion(v.getId());
        for (int i = 0; i < cleaned.size(); i++) {
            issues.save(new AssuranceIssue(v.getId(), cleaned.get(i).issue(), cleaned.get(i).remediation(), i));
        }
        v.markAssurance(req.status(), actor.id(), Instant.now());
        versions.save(v);

        boolean assured = req.status() == AssuranceStatus.ASSURED;
        audit.record(assured ? AuditAction.DEAL_VERSION_ASSURED : AuditAction.DEAL_VERSION_ACTION_REQUIRED,
                "Deal", d.getId(),
                "Version " + versionNo + " of deal " + d.getReference()
                        + (assured
                            ? " assured"
                            : " marked action required: " + cleaned.size()
                              + (cleaned.size() == 1 ? " issue — " : " issues — ")
                              + cleaned.stream().map(IssueDto::issue).collect(Collectors.joining("; "))));

        return toDto(v, usersById(Stream.of(v.getVerifiedByUserId(), actor.id())), cleaned);
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private Map<Long, User> usersById(Stream<Long> ids) {
        return users.findAllById(ids.filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static AssuranceVersionDto toDto(DealVersion v, Map<Long, User> people, List<IssueDto> issues) {
        return new AssuranceVersionDto(
                v.getVersionNo(),
                nameOf(people.get(v.getVerifiedByUserId())),
                v.getVerifiedAt(),
                v.getVerifyNote(),
                v.getReopenedAt(),
                v.getAssuranceStatus(),
                nameOf(people.get(v.getAssuranceByUserId())),
                v.getAssuranceAt(),
                issues);
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
