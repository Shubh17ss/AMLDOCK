package nz.amldock.deal.access;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealService;
import nz.amldock.deal.access.dto.DealUserDto;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Who may reach a deal, and letting more people in.
 *
 * <p>Only agents are worth adding. {@code ADMIN} and {@code SALES_MANAGER} already see every deal
 * in their branch and compliance sees every deal in the firm, so a grant to any of them would be a
 * row that changes nothing — offering them would promise access that was already there and imply it
 * could be taken away again by removing the row, which it could not.
 *
 * <p>Reading the list is gated on being able to read the deal. Changing it is narrower: the author,
 * the branch's sales manager, or firm compliance. An agent added to someone else's deal can work it
 * but cannot go on to add a third — access is something you are given, not something you pass on.
 */
@Service
public class DealUserService {

    /** The roles a grant actually does something for. See the class note. */
    private static final Set<Role> GRANTABLE = Set.of(Role.AGENT, Role.AGENT_PA);

    private final DealUserRepository dealUsers;
    private final DealRepository deals;
    private final UserRepository users;
    private final DealService dealService;
    private final AuditService audit;

    public DealUserService(DealUserRepository dealUsers, DealRepository deals, UserRepository users,
                           DealService dealService, AuditService audit) {
        this.dealUsers = dealUsers;
        this.deals = deals;
        this.users = users;
        this.dealService = dealService;
        this.audit = audit;
    }

    /**
     * Everyone who can open this deal by name: the author first, then whoever has been added.
     *
     * <p>Branch managers and firm compliance are not listed. They reach every deal in their scope,
     * so naming them here would turn a short, actionable list into a roster of the office that says
     * nothing specific to this deal.
     */
    @Transactional(readOnly = true)
    public List<DealUserDto> list(Long dealId) {
        Deal deal = mustReadDeal(dealId);

        List<Long> ids = new ArrayList<>();
        ids.add(deal.getCreatedByUserId());
        dealUsers.findAllByDealIdOrderByIdAsc(dealId).forEach(g -> ids.add(g.getUserId()));

        Map<Long, User> byId = new LinkedHashMap<>();
        users.findAllById(ids).forEach(u -> byId.put(u.getId(), u));

        // Built off `ids` rather than the fetched rows, so the author stays first and the grants
        // keep the order they were made in. A user deleted since is skipped, not rendered blank.
        return ids.stream()
                .distinct()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(u -> new DealUserDto(u.getId(), u.getFullName(), u.getEmail(), u.getRole(),
                        u.getId().equals(deal.getCreatedByUserId())))
                .toList();
    }

    /**
     * Who could still be added: the deal's own branch, agents only, minus those already on it.
     *
     * <p>A purpose-built list rather than {@code GET /api/users}, which an agent may not call at
     * all — without this an agent could never share their own deal. It is gated on being able to
     * read the deal and returns only that deal's branch, so it widens nothing else.
     */
    @Transactional(readOnly = true)
    public List<DealUserDto> candidates(Long dealId) {
        Deal deal = mustReadDeal(dealId);
        Set<Long> taken = dealUsers.findAllByDealIdOrderByIdAsc(dealId).stream()
                .map(DealUser::getUserId).collect(Collectors.toSet());
        taken.add(deal.getCreatedByUserId());

        return users.findByFirmBranchIdOrderByIdAsc(deal.getFirmBranchId()).stream()
                .filter(User::isActive)
                .filter(u -> GRANTABLE.contains(u.getRole()))
                .filter(u -> !taken.contains(u.getId()))
                .map(u -> new DealUserDto(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), false))
                .toList();
    }

    @Transactional
    public List<DealUserDto> add(Long dealId, Set<Long> userIds) {
        Deal deal = mustReadDeal(dealId);
        UserPrincipal actor = mustManage(deal);

        Map<Long, User> found = users.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        for (Long id : userIds) {
            User u = found.get(id);
            if (u == null) throw new NotFoundException("User " + id + " not found");
            // Checked per user rather than trusted from the picker: the picker is a convenience,
            // this is the boundary.
            if (!u.isActive()) {
                throw new BadRequestException(u.getFullName() + " is not an active user");
            }
            if (!GRANTABLE.contains(u.getRole())) {
                throw new BadRequestException(u.getFullName()
                        + " already sees every deal in scope — there is nothing to grant");
            }
            if (!deal.getFirmBranchId().equals(u.getFirmBranchId())) {
                throw new BadRequestException(u.getFullName() + " is not in this deal's branch");
            }
            if (id.equals(deal.getCreatedByUserId())) continue;          // already in, by authorship
            if (dealUsers.existsByDealIdAndUserId(dealId, id)) continue; // idempotent

            dealUsers.save(new DealUser(dealId, id, actor.id()));
            audit.record(AuditAction.DEAL_USER_ADDED, "Deal", dealId,
                    "Gave " + u.getFullName() + " access to this deal");
        }
        return list(dealId);
    }

    @Transactional
    public void remove(Long dealId, Long userId) {
        Deal deal = mustReadDeal(dealId);
        mustManage(deal);

        if (userId.equals(deal.getCreatedByUserId())) {
            throw new BadRequestException(
                    "The broker who created this deal cannot be removed from it");
        }
        dealUsers.findByDealIdAndUserId(dealId, userId).ifPresent(grant -> {
            dealUsers.delete(grant);
            String who = users.findById(userId).map(User::getFullName).orElse("User " + userId);
            audit.record(AuditAction.DEAL_USER_REMOVED, "Deal", dealId,
                    "Removed access to this deal for " + who);
        });
    }

    /* ---------- internals ---------- */

    /**
     * Loads the deal through {@code DealService.get}, which runs the same read check every other
     * deal-scoped endpoint runs. Going through it rather than repeating the rule is what keeps this
     * tab from drifting out of step with who can actually open the deal.
     */
    private Deal mustReadDeal(Long dealId) {
        dealService.get(dealId);
        return deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
    }

    /**
     * Who may change the list. Deliberately narrower than who may read it: an agent added to a deal
     * can work it, but cannot hand it on to someone else.
     */
    private UserPrincipal mustManage(Deal deal) {
        UserPrincipal actor = currentPrincipal();
        boolean allowed = switch (actor.role()) {
            case ROOT, AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> true;
            case SALES_MANAGER -> deal.getFirmBranchId().equals(actor.firmBranchId());
            case AGENT, AGENT_PA, ADMIN -> actor.id().equals(deal.getCreatedByUserId());
            case AUDIT, FINANCE -> false;
        };
        if (!allowed) {
            throw new ForbiddenException(
                    "Only the broker who created this deal, their sales manager, or a compliance "
                            + "officer or senior manager of the firm may change who can see it");
        }
        return actor;
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
