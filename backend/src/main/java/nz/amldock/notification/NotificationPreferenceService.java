package nz.amldock.notification;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.notification.dto.NotificationPreferenceDto;
import nz.amldock.notification.dto.NotificationPreferenceGridDto;
import nz.amldock.notification.dto.UpdateNotificationPreferencesRequest;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads and writes deal notification preferences, for the signed-in user and — for officers — for
 * anyone in their firm.
 *
 * <p>Reads synthesise a full grid rather than returning stored rows: a missing row is the normal
 * state, meaning the role default, so the API answers with the effective value and says whether it
 * was explicit. See {@link NotificationDefaults} for why absence rather than seeding.
 */
@Service
public class NotificationPreferenceService {

    private final DealNotificationPreferenceRepository preferences;
    private final FirmBranchRepository branches;
    private final UserRepository users;
    private final AuditService audit;

    public NotificationPreferenceService(DealNotificationPreferenceRepository preferences,
                                         FirmBranchRepository branches,
                                         UserRepository users,
                                         AuditService audit) {
        this.preferences = preferences;
        this.branches = branches;
        this.users = users;
        this.audit = audit;
    }

    /* ---------- reads ---------- */

    @Transactional(readOnly = true)
    public NotificationPreferenceGridDto forCurrentUser() {
        User me = users.findById(currentPrincipal().id())
                .orElseThrow(() -> new NotFoundException("User not found"));
        return grid(me);
    }

    /**
     * Everyone in a branch who could be notified, with their current toggles — the Settings matrix.
     *
     * <p>Scoped to one branch because that is the dimension the preferences turn on, and because
     * the sidebar already has a branch selected. A user × branch × event grid would be a third
     * dimension the UI has nowhere to put.
     */
    @Transactional(readOnly = true)
    public List<NotificationPreferenceGridDto> forBranch(Long branchId) {
        UserPrincipal actor = currentPrincipal();
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new NotFoundException("Branch " + branchId + " not found"));
        assertCanSeeFirm(actor, branch.getRealEstateFirmId());

        // Branch staff plus the firm-level officers above them: the same population the recipient
        // query considers for this branch, so the screen shows exactly who could be mailed.
        List<User> candidates = new ArrayList<>();
        for (User u : users.findByFirmBranchIdOrderByIdAsc(branchId)) {
            if (u.isActive() && NotificationEligibility.isEligible(u.getRole())) candidates.add(u);
        }
        for (User u : users.findByRealEstateFirmIdOrderByIdAsc(branch.getRealEstateFirmId())) {
            if (u.isActive() && NotificationEligibility.isFirmWide(u.getRole())) candidates.add(u);
        }

        return candidates.stream().map(u -> grid(u, List.of(branch))).toList();
    }

    /* ---------- writes ---------- */

    @Transactional
    public NotificationPreferenceGridDto updateForCurrentUser(
            UpdateNotificationPreferencesRequest req) {
        User me = users.findById(currentPrincipal().id())
                .orElseThrow(() -> new NotFoundException("User not found"));
        return apply(me, req);
    }

    @Transactional
    public NotificationPreferenceGridDto updateForUser(
            Long userId, UpdateNotificationPreferencesRequest req) {
        UserPrincipal actor = currentPrincipal();
        User target = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User " + userId + " not found"));
        assertCanAdminister(actor, target);
        return apply(target, req);
    }

    private NotificationPreferenceGridDto apply(User target,
                                                UpdateNotificationPreferencesRequest req) {
        if (!NotificationEligibility.isEligible(target.getRole())) {
            throw new BadRequestException(
                    "The " + target.getRole() + " role does not receive deal notifications");
        }
        Long actorId = currentPrincipal().id();

        for (UpdateNotificationPreferencesRequest.Entry e : req.preferences()) {
            assertBranchInScope(target, e.firmBranchId());

            DealNotificationPreference row = preferences
                    .findByAppUserIdAndFirmBranchIdAndEventType(
                            target.getId(), e.firmBranchId(), e.eventType())
                    .orElseGet(() -> {
                        DealNotificationPreference fresh = new DealNotificationPreference();
                        fresh.setAppUserId(target.getId());
                        fresh.setFirmBranchId(e.firmBranchId());
                        fresh.setEventType(e.eventType());
                        return fresh;
                    });
            row.setEnabled(e.enabled());
            row.setUpdatedByUserId(actorId);
            preferences.save(row);
        }

        audit.record(AuditAction.NOTIFICATION_PREFERENCE_UPDATED, "User", target.getId(),
                "Updated " + req.preferences().size() + " deal notification preference(s) for "
                        + target.getEmail());
        return grid(target);
    }

    /* ---------- authorization ---------- */

    /**
     * Who may edit somebody else's notification preferences.
     *
     * <p>Deliberately <strong>not</strong> {@code UserService.assertCanManage}, which refuses to let
     * one firm-level user edit another. That rule protects an account-control surface — it stops a
     * compliance officer unseating a senior manager — and has no bearing here. Deciding who is
     * emailed about a deal is not an account change, and an officer needs to be able to quiet a
     * peer who is drowning in mail.
     */
    private void assertCanAdminister(UserPrincipal actor, User target) {
        if (actor.role() == Role.ROOT) return;
        if (actor.role().isFirmLevel()) {
            if (target.getRealEstateFirmId() == null
                    || !target.getRealEstateFirmId().equals(actor.realEstateFirmId())) {
                throw new ForbiddenException("This user is not in your firm");
            }
            return;
        }
        throw new ForbiddenException(
                "Only a compliance officer or senior manager may change another user's notifications");
    }

    private void assertCanSeeFirm(UserPrincipal actor, Long firmId) {
        if (actor.role().seesAllFirms()) return;
        if (firmId == null || !firmId.equals(actor.realEstateFirmId())) {
            throw new ForbiddenException("This branch is not in your firm");
        }
    }

    /**
     * A subscription is only meaningful for a branch the user could see deals in — their own for
     * branch-level staff, any branch of their firm for an officer. Without this a toggle could be
     * stored that the recipient query would never honour, which would read as a broken screen.
     */
    private void assertBranchInScope(User target, Long branchId) {
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));

        if (NotificationEligibility.isFirmWide(target.getRole())) {
            if (!branch.getRealEstateFirmId().equals(target.getRealEstateFirmId())) {
                throw new BadRequestException("Branch does not belong to this user's firm");
            }
            return;
        }
        if (!branchId.equals(target.getFirmBranchId())) {
            throw new BadRequestException("Branch-level staff can only be notified about their own branch");
        }
    }

    /* ---------- grid assembly ---------- */

    private NotificationPreferenceGridDto grid(User user) {
        return grid(user, branchesFor(user));
    }

    /**
     * The branches a user chooses between: their own if they have one, every active branch of their
     * firm if they are firm-level.
     */
    private List<FirmBranch> branchesFor(User user) {
        if (NotificationEligibility.isFirmWide(user.getRole())) {
            return branches.findAllByRealEstateFirmIdOrderByNameAsc(user.getRealEstateFirmId())
                    .stream().filter(FirmBranch::isActive).toList();
        }
        if (user.getFirmBranchId() == null) return List.of();
        return branches.findById(user.getFirmBranchId()).map(List::of).orElse(List.of());
    }

    /**
     * Builds the full branch x event grid, filling gaps from {@link NotificationDefaults} so the
     * caller always sees an effective answer.
     */
    private NotificationPreferenceGridDto grid(User user, List<FirmBranch> scope) {
        if (!NotificationEligibility.isEligible(user.getRole())) {
            return new NotificationPreferenceGridDto(user.getId(), user.getFullName(),
                    user.getEmail(), user.getRole(), List.of());
        }

        Map<String, DealNotificationPreference> stored = new HashMap<>();
        for (DealNotificationPreference p : preferences.findByAppUserId(user.getId())) {
            stored.put(key(p.getFirmBranchId(), p.getEventType()), p);
        }

        List<NotificationPreferenceDto> entries = new ArrayList<>();
        for (FirmBranch branch : scope) {
            for (DealNotificationEvent event : DealNotificationEvent.values()) {
                DealNotificationPreference p = stored.get(key(branch.getId(), event));
                entries.add(new NotificationPreferenceDto(
                        branch.getId(),
                        branch.getName(),
                        event,
                        p != null ? p.isEnabled()
                                  : NotificationDefaults.defaultEnabled(user.getRole(), event),
                        p != null ? NotificationPreferenceDto.EXPLICIT
                                  : NotificationPreferenceDto.DEFAULT));
            }
        }
        return new NotificationPreferenceGridDto(user.getId(), user.getFullName(),
                user.getEmail(), user.getRole(), entries);
    }

    private static String key(Long branchId, DealNotificationEvent event) {
        return branchId + ":" + event.name();
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
