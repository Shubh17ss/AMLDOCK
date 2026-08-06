package nz.amldock.training;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collection;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The firm/branch scoping rules shared by the two training services. Same semantics as the
 * private helpers in {@link nz.amldock.suspiciousactivity.SuspiciousActivityService}, lifted
 * into one place here because providers and sessions both need them.
 */
final class TrainingScope {

    private TrainingScope() {}

    static UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }

    /** ROOT may target any firm (or the platform register when null); everyone else is pinned to their own. */
    static Long resolveTargetFirm(UserPrincipal actor, Long requestedFirmId) {
        if (actor.role().seesAllFirms()) return requestedFirmId;
        return actor.realEstateFirmId();
    }

    /** A user may only touch records in their own firm (ROOT: any, including the firm-less one). */
    static void assertSameFirm(UserPrincipal actor, Long recordFirmId, String label) {
        boolean sameFirm = actor.realEstateFirmId() == null
                ? recordFirmId == null
                : actor.realEstateFirmId().equals(recordFirmId);
        if (!sameFirm && !actor.role().seesAllFirms()) {
            throw new ForbiddenException("This " + label + " belongs to another firm");
        }
    }

    /**
     * Who may be assigned training, across two tiers of the same firm:
     *   branch-level staff (sales manager, agent, agent PA, branch admin) sitting in this
     *     record's own branch;
     *   firm-level staff (compliance officer, senior manager), who are branchless and oversee
     *     every branch — they run training and also have their own obligations to meet.
     *
     * ROOT is a platform account with no firm, so it never holds an assignment.
     *
     * Shared by sessions and courses so the rule can't drift between them. Never trust the
     * client's list: {@code GET /api/users?branchId=} returns branch staff *and* the firm's
     * branchless firm-level staff, and neither tier is checked anywhere else.
     */
    static void assertAssignable(UserRepository users, Long firmId, Long branchId,
                                 Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return;

        Map<Long, User> found = users.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        for (Long userId : userIds) {
            User u = found.get(userId);
            if (u == null) {
                throw new BadRequestException("User " + userId + " not found");
            }
            Role role = u.getRole();
            if (!role.isBranchLevel() && !role.isFirmLevel()) {
                throw new BadRequestException(
                        u.getEmail() + " cannot be assigned training");
            }
            boolean sameFirm = firmId != null && firmId.equals(u.getRealEstateFirmId());
            if (!sameFirm) {
                throw new BadRequestException(u.getEmail() + " is not in this reporting entity");
            }
            // Only branch staff are pinned to a branch; firm-level staff have none by design.
            if (role.isBranchLevel() && !(branchId != null && branchId.equals(u.getFirmBranchId()))) {
                throw new BadRequestException(u.getEmail() + " is not in this branch");
            }
        }
    }
}
