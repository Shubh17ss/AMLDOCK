package nz.amldock.user;

import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Which reporting entities an account belongs to, and in what role. See FirmMembership and
 * V68__firm_membership.sql.
 *
 * <p>The one rule: an account may be active in several entities only if it is firm-level staff
 * (compliance officer or senior manager) in every one of them. Anyone else is active in at most
 * one, and has to be switched off there before they can be added anywhere else. The old row stays,
 * inactive, so the deals and the audit trail they left in that entity still name the same person.
 *
 * <p>Also keeps the account row in step with its memberships ({@link #syncAccount}): app_user's
 * role, firm and branch name the home membership, and its {@code is_active} means "active
 * somewhere". Every method here that changes a membership calls it, so callers need not.
 *
 * <p>Ending sessions is the caller's job (UserService.endSessions), because whether a change calls
 * for it depends on what changed.
 */
@Service
public class MembershipService {

    private final FirmMembershipRepository memberships;
    private final UserRepository users;
    private final RealEstateFirmRepository firms;

    public MembershipService(FirmMembershipRepository memberships, UserRepository users,
                             RealEstateFirmRepository firms) {
        this.memberships = memberships;
        this.users = users;
        this.firms = firms;
    }

    /* ---------- reads ---------- */

    @Transactional(readOnly = true)
    public List<FirmMembership> activeOf(Long userId) {
        return memberships.findByUserIdAndActiveTrueOrderByIdAsc(userId);
    }

    @Transactional(readOnly = true)
    public Optional<FirmMembership> in(Long userId, Long firmId) {
        if (firmId == null) return Optional.empty();
        return memberships.findByUserIdAndRealEstateFirmId(userId, firmId);
    }

    @Transactional(readOnly = true)
    public Optional<FirmMembership> activeIn(Long userId, Long firmId) {
        return in(userId, firmId).filter(FirmMembership::isActive);
    }

    /**
     * The membership a new session for this account starts in: its home, or failing that its
     * first active one. Empty for ROOT and AUDIT, and for an account active nowhere.
     */
    @Transactional(readOnly = true)
    public Optional<FirmMembership> sessionStart(User u) {
        List<FirmMembership> active = activeOf(u.getId());
        return active.stream()
                .filter(m -> m.getRealEstateFirmId().equals(u.getRealEstateFirmId()))
                .findFirst()
                .or(() -> active.stream().findFirst());
    }

    /* ---------- writes ---------- */

    /** Outcome of {@link #join}: the row, and whether it was there before this call. */
    public record Joined(FirmMembership membership, boolean existed) {}

    /**
     * Puts an account into an entity in a role: a new row, or the old one switched back on with
     * the new role and branch. Refused when the account is active elsewhere in a way the rule does
     * not allow. {@code revealEntity} decides whether that refusal may name the other entity — only
     * a caller who can see every entity should learn where else an address is in use.
     */
    @Transactional
    public Joined join(User u, Role role, Long firmId, Long branchId, boolean revealEntity) {
        users.findByIdForUpdate(u.getId());
        FirmMembership m = memberships.findByUserIdAndRealEstateFirmId(u.getId(), firmId).orElse(null);
        boolean existed = m != null;
        if (existed && m.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    u.getEmail() + " is already a member of this reporting entity");
        }
        assertMayBeActive(u, firmId, role, revealEntity);
        if (!existed) {
            m = new FirmMembership();
            m.setUserId(u.getId());
            m.setRealEstateFirmId(firmId);
        }
        m.setRole(role);
        m.setFirmBranchId(branchId);
        m.setActive(true);
        memberships.save(m);
        syncAccount(u);
        return new Joined(m, existed);
    }

    /** Switches one membership on or off. Switching on is held to the same rule as joining. */
    @Transactional
    public void setActive(User u, FirmMembership m, boolean active, boolean revealEntity) {
        users.findByIdForUpdate(u.getId());
        if (active && !m.isActive()) {
            assertMayBeActive(u, m.getRealEstateFirmId(), m.getRole(), revealEntity);
        }
        m.setActive(active);
        memberships.save(m);
        syncAccount(u);
    }

    /**
     * A new role and/or branch within the same entity. A move out of firm-level staff is held to
     * the rule too: a compliance officer in two entities cannot become an agent in one of them.
     */
    @Transactional
    public void change(User u, FirmMembership m, Role role, Long branchId, boolean revealEntity) {
        users.findByIdForUpdate(u.getId());
        if (m.isActive() && role != m.getRole()) {
            assertMayBeActive(u, m.getRealEstateFirmId(), role, revealEntity);
        }
        m.setRole(role);
        m.setFirmBranchId(branchId);
        memberships.save(m);
        syncAccount(u);
    }

    /** Makes {@code m} the account's home: the entity its next sign-in starts in. */
    @Transactional
    public void makeHome(User u, FirmMembership m) {
        copyToAccount(u, m);
    }

    /**
     * Brings app_user in line with the memberships: active iff some membership is, and the home
     * always one of the active ones (refreshed from it, since its role or branch may have moved).
     * With none active the home is left naming the last one, so the row still says where they were.
     */
    @Transactional
    public void syncAccount(User u) {
        if (u.getRole() != null && u.getRole().seesAllFirms()) return;
        List<FirmMembership> active = memberships.findByUserIdAndActiveTrueOrderByIdAsc(u.getId());
        if (active.isEmpty()) {
            u.setActive(false);
            memberships.findByUserIdAndRealEstateFirmId(u.getId(), u.getRealEstateFirmId())
                    .ifPresent(m -> copyToAccount(u, m));
            return;
        }
        u.setActive(true);
        FirmMembership home = active.stream()
                .filter(m -> m.getRealEstateFirmId().equals(u.getRealEstateFirmId()))
                .findFirst()
                .orElse(active.get(0));
        copyToAccount(u, home);
    }

    /* ---------- the rule ---------- */

    private void assertMayBeActive(User u, Long firmId, Role role, boolean revealEntity) {
        List<FirmMembership> others = memberships.findByUserIdAndActiveTrueOrderByIdAsc(u.getId())
                .stream()
                .filter(o -> !o.getRealEstateFirmId().equals(firmId))
                .toList();
        if (others.isEmpty()) return;
        if (role.isFirmLevel() && others.stream().allMatch(o -> o.getRole().isFirmLevel())) return;

        FirmMembership blocking = others.stream()
                .filter(o -> !role.isFirmLevel() || !o.getRole().isFirmLevel())
                .findFirst()
                .orElse(others.get(0));
        String where = revealEntity
                ? firms.findById(blocking.getRealEstateFirmId()).map(RealEstateFirm::getName)
                        .orElse("another reporting entity")
                : "another reporting entity";
        String why = role.isFirmLevel()
                ? u.getEmail() + " is active as " + blocking.getRole() + " in " + where
                        + ". Only compliance officers and senior managers can belong to more than one"
                        + " reporting entity — deactivate them there first."
                : u.getEmail() + " is active in " + where
                        + ". Deactivate them there before adding them here.";
        throw new ApiException(HttpStatus.CONFLICT, why);
    }

    private static void copyToAccount(User u, FirmMembership m) {
        if (!Objects.equals(u.getRole(), m.getRole())) u.setRole(m.getRole());
        if (!Objects.equals(u.getRealEstateFirmId(), m.getRealEstateFirmId())) {
            u.setRealEstateFirmId(m.getRealEstateFirmId());
        }
        if (!Objects.equals(u.getFirmBranchId(), m.getFirmBranchId())) u.setFirmBranchId(m.getFirmBranchId());
    }

    /** The membership by id, if it is this account's. Anyone else's reads as missing. */
    @Transactional(readOnly = true)
    public FirmMembership ownedBy(Long userId, Long membershipId) {
        return memberships.findById(membershipId)
                .filter(m -> m.getUserId().equals(userId))
                .orElseThrow(() -> new NotFoundException("Membership " + membershipId + " not found"));
    }
}
