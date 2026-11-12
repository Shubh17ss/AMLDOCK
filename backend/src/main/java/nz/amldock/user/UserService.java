package nz.amldock.user;

import nz.amldock.auth.RefreshTokenRepository;
import nz.amldock.auth.TokenStateCache;
import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.BulkValidationException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.common.web.ApiError;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.dto.BulkCreateUsersRequest;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.UpdateUserRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository users;
    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;
    private final PasswordEncoder encoder;
    private final RefreshTokenRepository refreshTokens;
    private final TokenStateCache tokenStates;
    private final FirmMembershipRepository membershipRepo;
    private final MembershipService memberships;

    public UserService(UserRepository users,
                       RealEstateFirmRepository firms,
                       FirmBranchRepository branches,
                       PasswordEncoder encoder,
                       RefreshTokenRepository refreshTokens,
                       TokenStateCache tokenStates,
                       FirmMembershipRepository membershipRepo,
                       MembershipService memberships) {
        this.users = users;
        this.firms = firms;
        this.branches = branches;
        this.encoder = encoder;
        this.refreshTokens = refreshTokens;
        this.tokenStates = tokenStates;
        this.membershipRepo = membershipRepo;
        this.memberships = memberships;
    }

    /**
     * An account as seen from one reporting entity: the account, and its membership there. The
     * membership is null for ROOT and AUDIT, who belong to none, and — in an unfiltered platform
     * listing — names the account's home entity.
     *
     * <p>Role, branch and active-ness are the membership's: an officer serving two entities is
     * listed in each with that entity's role, and switched off in one without the other.
     */
    public record Member(User user, FirmMembership membership) {
        public Role role() { return membership == null ? user.getRole() : membership.getRole(); }
        public Long firmId() { return membership == null ? user.getRealEstateFirmId() : membership.getRealEstateFirmId(); }
        public Long branchId() { return membership == null ? user.getFirmBranchId() : membership.getFirmBranchId(); }
        public boolean active() { return membership == null ? user.isActive() : membership.isActive(); }
    }

    /** What {@link #create} did with the address: a new account, or an existing one added here. */
    public record Created(Member member, boolean existingAccount) {}

    // Stable display order so toggling active/inactive (or any update) never reshuffles the list.
    private static final Sort BY_ID = Sort.by(Sort.Direction.ASC, "id");

    @Transactional(readOnly = true)
    public List<User> findAll() {
        return users.findAll(BY_ID);
    }

    /**
     * Users the actor may see, as members of the entity in view, further narrowed to the firm and
     * branch selected in the UI. The tier scope always applies first, so the filter can only ever
     * shrink what the actor is already permitted to see:
     * <ul>
     *   <li>ROOT / AUDIT see every account. Without a firm, one row per account, in its home entity;
     *       with one, that entity's members plus the firm-less platform accounts (ROOT, AUDIT) —
     *       without which an auditor, who belongs to no reporting entity by design, vanished from
     *       Settings › Users the moment an entity was picked;</li>
     *   <li>firm-level staff see their own entity's members;</li>
     *   <li>a sales manager sees their own branch's;</li>
     *   <li>agents, branch admins and FINANCE don't see the user register.</li>
     * </ul>
     * A selected <b>branch</b> keeps that branch's members <em>and</em> the entity's branchless
     * firm-level staff, who oversee the branch without sitting inside it.
     */
    @Transactional(readOnly = true)
    public List<Member> findVisible(UserPrincipal actor, Long firmId, Long branchId) {
        Role role = actor.role();
        List<Member> scoped;
        if (role.seesAllFirms()) {
            scoped = firmId == null ? everyAccount() : membersOf(firmId, true);
        } else if (role.isFirmLevel()) {
            scoped = membersOf(actor.realEstateFirmId(), false);
        } else if (role == Role.SALES_MANAGER) {
            scoped = withAccounts(membershipRepo.findByFirmBranchIdOrderByUserIdAsc(actor.firmBranchId()));
        } else {
            return List.of();
        }
        return scoped.stream()
                .filter(m -> firmId == null || m.firmId() == null || firmId.equals(m.firmId()))
                .filter(m -> branchId == null || m.branchId() == null || branchId.equals(m.branchId()))
                .toList();
    }

    /** Every account once, each in its home entity. ROOT and AUDIT, who have none, as themselves. */
    private List<Member> everyAccount() {
        List<User> all = users.findAll(BY_ID);
        Map<Long, List<FirmMembership>> byUser = membershipRepo
                .findByUserIdIn(all.stream().map(User::getId).toList()).stream()
                .collect(Collectors.groupingBy(FirmMembership::getUserId));
        return all.stream().map(u -> new Member(u, byUser.getOrDefault(u.getId(), List.of()).stream()
                        .filter(m -> m.getRealEstateFirmId().equals(u.getRealEstateFirmId()))
                        .findFirst().orElse(null)))
                .toList();
    }

    /** One entity's members, active or not, plus the platform accounts when asked for. */
    private List<Member> membersOf(Long firmId, boolean withPlatformAccounts) {
        List<Member> out = new ArrayList<>(withAccounts(membershipRepo.findByRealEstateFirmIdOrderByUserIdAsc(firmId)));
        if (withPlatformAccounts) {
            users.findAll(BY_ID).stream()
                    .filter(u -> u.getRole().seesAllFirms())
                    .forEach(u -> out.add(new Member(u, null)));
            out.sort(Comparator.comparing(m -> m.user().getId()));
        }
        return out;
    }

    private List<Member> withAccounts(List<FirmMembership> rows) {
        Map<Long, User> byId = users.findAllById(rows.stream().map(FirmMembership::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return rows.stream()
                .filter(m -> byId.containsKey(m.getUserId()))
                .map(m -> new Member(byId.get(m.getUserId()), m))
                .toList();
    }

    @Transactional(readOnly = true)
    public User findById(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    /**
     * One user, as a member of the entity in view, if the actor could see them in
     * {@link #findVisible}. Same tier rule, so the single-item read never shows more than the list
     * does. Anyone out of scope is a 404, not a 403: ids are sequential, and a different answer
     * would say which ones exist.
     *
     * <p>{@code firmId} picks the entity for ROOT and AUDIT; without it, the account's home.
     * Everyone else always sees the user as a member of their own entity.
     */
    @Transactional(readOnly = true)
    public Member findVisibleById(UserPrincipal actor, Long id, Long firmId) {
        User u = findById(id);
        Role role = actor.role();
        if (role.seesAllFirms()) {
            if (u.getRole().seesAllFirms()) return new Member(u, null);
            Long firm = firmId != null ? firmId : u.getRealEstateFirmId();
            return memberships.in(u.getId(), firm).map(m -> new Member(u, m))
                    .orElseThrow(() -> new NotFoundException("User " + id + " not found"));
        }
        FirmMembership m = memberships.in(u.getId(), actor.realEstateFirmId()).orElse(null);
        boolean visible = m != null
                && (role.isFirmLevel()
                    || (role == Role.SALES_MANAGER && actor.firmBranchId() != null
                        && actor.firmBranchId().equals(m.getFirmBranchId())));
        if (!visible) {
            throw new NotFoundException("User " + id + " not found");
        }
        return new Member(u, m);
    }

    /**
     * Create a user below the actor in the hierarchy, or add an existing account to this entity.
     * Enforces:
     *   1. the actor may create the requested role (top tier creates the tier below, never otherwise);
     *   2. firm/branch linkage matches the target role's tier;
     *   3. the new user lands within the actor's own scope (firm for firm-level creators,
     *      firm + branch for the sales manager);
     *   4. an address already in use joins its account to this entity rather than failing — if
     *      MembershipService's rule allows it: several entities at once for compliance officers
     *      and senior managers only, and for anyone else only once they are switched off where
     *      they were. The account's name is kept; it is theirs, not this entity's.
     */
    @Transactional
    public Created create(UserPrincipal creator, CreateUserRequest req) {
        if (!creator.role().canCreate(req.role())) {
            throw new ForbiddenException(creator.role() + " is not permitted to create " + req.role() + " users");
        }

        Long firmId = req.realEstateFirmId();
        Long branchId = req.firmBranchId();
        bindCreationScope(creator, req.role(), firmId, branchId);
        validateFirmLinkage(req.role(), firmId, branchId);

        User existing = users.findByEmailIgnoreCase(req.email()).orElse(null);
        if (existing != null) {
            if (!req.role().requiresFirm() || existing.getRole().seesAllFirms()) {
                throw new BadRequestException("Email already in use");
            }
            MembershipService.Joined joined = memberships.join(
                    existing, req.role(), firmId, branchId, creator.role().seesAllFirms());
            return new Created(new Member(existing, joined.membership()), true);
        }

        User u = new User();
        u.setEmail(req.email().toLowerCase());
        u.setFullName(req.fullName());
        // The account's home starts as this membership; see MembershipService.syncAccount.
        u.setRole(req.role());
        u.setRealEstateFirmId(firmId);
        u.setFirmBranchId(branchId);
        // Passwordless: these users sign in with email + OTP.
        u.setActive(true);
        u = users.save(u);
        if (!req.role().requiresFirm()) {
            return new Created(new Member(u, null), false);
        }
        FirmMembership m = memberships.join(u, req.role(), firmId, branchId, true).membership();
        return new Created(new Member(u, m), false);
    }

    /** Most users one bulk import may create. Mirrored by MAX_BULK_USERS in CreateUserDialog.jsx. */
    public static final int MAX_BULK_ROWS = 50;
    /** RFC 5321 path limit. Checked before the regex so the match always runs on bounded input. */
    private static final int MAX_EMAIL_LENGTH = 254;
    /** users.full_name is VARCHAR(255). */
    private static final int MAX_FULL_NAME_LENGTH = 255;

    // Domain labels exclude '.', so the label and separator never overlap and the match is linear.
    // The previous form ([^@\s]+\.[^@\s]+$ after the '@') backtracked quadratically on a run of dots.
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s.]+(?:\\.[^@\\s.]+)+$");

    /**
     * Bulk-create users from a parsed CSV. Every row is validated against the same rules as the
     * single-user {@link #create} path (role feasibility, scope binding, firm/branch linkage,
     * existing addresses joining this entity under the membership rule) plus in-file duplicate
     * detection. All-or-nothing: if any row is invalid,
     * a {@link BulkValidationException} listing every reason is thrown and nothing is persisted.
     * No onboarding/welcome emails are sent for imported users.
     */
    @Transactional
    public List<Member> createBulk(UserPrincipal creator, BulkCreateUsersRequest req) {
        // Who may import at all is settled before a single row is looked at.
        if (creator.role().creatableRoles().isEmpty()) {
            throw new ForbiddenException("You are not permitted to create users");
        }
        List<BulkCreateUsersRequest.Row> rows = req.rows() == null ? List.of() : req.rows();
        if (rows.isEmpty()) {
            throw new BadRequestException("The file has no rows to import");
        }
        if (rows.size() > MAX_BULK_ROWS) {
            throw new BadRequestException("A bulk import can contain at most " + MAX_BULK_ROWS + " users");
        }

        // Firm context: ROOT supplies it; everyone else is pinned to their own firm.
        Long contextFirmId = creator.role() == Role.ROOT ? req.realEstateFirmId() : creator.realEstateFirmId();

        List<ApiError.FieldError> errors = new ArrayList<>();
        List<Member> created = new ArrayList<>();
        Set<String> seenEmails = new HashSet<>();

        for (int i = 0; i < rows.size(); i++) {
            BulkCreateUsersRequest.Row row = rows.get(i);
            String field = "row " + (i + 1);
            try {
                String fullName = row.fullName() == null ? "" : row.fullName().trim();
                String email = row.email() == null ? "" : row.email().trim();
                if (fullName.isEmpty()) throw new BadRequestException("full name is required");
                if (fullName.length() > MAX_FULL_NAME_LENGTH) throw new BadRequestException("full name is too long");
                if (email.isEmpty()) throw new BadRequestException("email is required");
                if (email.length() > MAX_EMAIL_LENGTH) throw new BadRequestException("email is too long");
                if (!EMAIL.matcher(email).matches()) throw new BadRequestException("invalid email: " + email);

                Role role = parseRole(row.role());
                if (!creator.role().canCreate(role)) {
                    throw new ForbiddenException("you are not permitted to create " + role + " users");
                }

                String emailKey = email.toLowerCase();
                if (!seenEmails.add(emailKey)) {
                    throw new BadRequestException("duplicate email in file: " + email);
                }
                Long firmId = role.requiresFirm() ? contextFirmId : null;
                Long branchId = resolveBranchId(creator, role, firmId, row.branchName());

                bindCreationScope(creator, role, firmId, branchId);
                validateFirmLinkage(role, firmId, branchId);

                // The same path as a single create, existing addresses included. Rows are written
                // as they pass; a later row's failure rolls them all back, because the whole
                // import is one transaction and fails by throwing.
                CreateUserRequest single = new CreateUserRequest(email, fullName, role, firmId, branchId);
                created.add(create(creator, single).member());
            } catch (ApiException ex) {
                errors.add(new ApiError.FieldError(field, ex.getMessage()));
            }
        }

        if (!errors.isEmpty()) {
            throw new BulkValidationException(errors);
        }
        return created;
    }

    /** Normalise a free-text role: case-, space- and hyphen-insensitive against the enum names. */
    private Role parseRole(String raw) {
        if (raw == null || raw.isBlank()) throw new BadRequestException("role is required");
        String norm = raw.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        for (Role r : Role.values()) {
            if (r.name().equals(norm)) return r;
        }
        throw new BadRequestException("unknown role: " + raw.trim());
    }

    /**
     * Resolve the branch for an imported user. A sales manager's new staff are forced into their
     * own branch (the CSV branch column is ignored); firm-level / ROOT importers resolve the branch
     * by name within the firm. Firm-level target roles must leave the branch blank.
     */
    private Long resolveBranchId(UserPrincipal creator, Role role, Long firmId, String branchName) {
        if (!role.requiresBranch()) {
            if (branchName != null && !branchName.isBlank()) {
                throw new BadRequestException(role + " must not have a branch — leave the branch column blank");
            }
            return null;
        }
        if (creator.role() == Role.SALES_MANAGER) {
            return creator.firmBranchId(); // bindCreationScope/validateFirmLinkage verify it
        }
        if (firmId == null) {
            throw new BadRequestException("no firm context to resolve the branch");
        }
        if (branchName == null || branchName.isBlank()) {
            throw new BadRequestException("branch is required for " + role);
        }
        FirmBranch branch = branches.findByRealEstateFirmIdAndNameIgnoreCase(firmId, branchName.trim())
                .orElseThrow(() -> new BadRequestException("branch not found in this firm: " + branchName.trim()));
        return branch.getId();
    }

    /**
     * Edits a user as a member of the entity in view ({@code firmId}: ROOT's pick, or the account's
     * home; everyone else's own entity). Role, branch and active-ness change that membership only.
     * The name and address belong to the account, so for someone who also serves another entity
     * only they themselves or ROOT may change them — one entity's officer must not rename a person
     * out from under another.
     */
    @Transactional
    public Member update(UserPrincipal actor, Long id, Long firmId, UpdateUserRequest req) {
        User u = findById(id);
        boolean isRoot = actor.role() == Role.ROOT;
        Long contextFirm = isRoot
                ? (req.realEstateFirmId() != null ? req.realEstateFirmId()
                        : firmId != null ? firmId : u.getRealEstateFirmId())
                : actor.realEstateFirmId();
        FirmMembership m = u.getRole().seesAllFirms() ? null
                : memberships.in(u.getId(), contextFirm)
                        .orElseThrow(() -> new NotFoundException("User " + id + " not found"));
        assertCanManage(actor, new Member(u, m));

        if (changes(req.fullName(), u.getFullName()) || changesEmail(req.email(), u.getEmail())) {
            assertMayEditAccount(actor, u, m);
        }
        if (req.fullName() != null && !req.fullName().isBlank()) {
            u.setFullName(req.fullName());
        }
        if (changesEmail(req.email(), u.getEmail())) {
            if (users.existsByEmailIgnoreCaseAndIdNot(req.email(), u.getId())) {
                throw new BadRequestException("Email already in use");
            }
            u.setEmail(req.email().toLowerCase());
        }

        boolean endSessions = false;
        // Role and branch stay platform-admin concerns — they decide what a user *is* in an entity,
        // which is not a firm manager's call to make. The entity itself is no longer edited here:
        // a move is "deactivate there, add here", so the old membership keeps its history.
        if (isRoot && m != null && (req.role() != null || req.firmBranchId() != null)) {
            Role role = req.role() != null ? req.role() : m.getRole();
            Long branchId = req.role() != null ? req.firmBranchId()
                    : (req.firmBranchId() != null ? req.firmBranchId() : m.getFirmBranchId());
            validateFirmLinkage(role, m.getRealEstateFirmId(), branchId);
            if (role != m.getRole() || !Objects.equals(branchId, m.getFirmBranchId())) {
                memberships.change(u, m, role, branchId, true);
                endSessions = true;
            }
        } else if (isRoot && m == null && req.role() != null && req.role() != u.getRole()) {
            throw new BadRequestException(
                    "A platform account's role can't be changed here — create the account it should be instead");
        }

        // Suspending is the same authority as creating, so it is governed by the same check:
        // assertCanManage above has already settled the scope (firm-level staff over their own
        // firm but not their peers, a sales manager over their own branch, ROOT over anyone but
        // another ROOT). It switches off this entity's membership only; an officer serving two
        // entities stays live in the other.
        boolean activeNow = m == null ? u.isActive() : m.isActive();
        if (req.active() != null && req.active() != activeNow) {
            // assertCanManage deliberately lets an actor act on themselves, so that a manager can
            // fix their own name. Suspension is the one thing that must not follow from that: a
            // firm whose only compliance officer switched their own account off has nobody left
            // who can switch it back on.
            if (actor.id().equals(u.getId())) {
                throw new BadRequestException("You can't change your own account's status");
            }
            if (m == null) {
                u.setActive(req.active());
            } else {
                memberships.setActive(u, m, req.active(), isRoot || actor.role().seesAllFirms());
            }
            if (!req.active()) endSessions = true;
        }
        // Sessions are per account, not per entity: switching someone off in one entity ends their
        // sessions everywhere, and they sign back in to whichever entities they still have.
        if (endSessions) {
            endSessions(u);
        }
        return new Member(u, m);
    }

    private static boolean changes(String requested, String current) {
        return requested != null && !requested.isBlank() && !requested.equals(current);
    }

    private static boolean changesEmail(String requested, String current) {
        return requested != null && !requested.isBlank() && !requested.equalsIgnoreCase(current);
    }

    private void assertMayEditAccount(UserPrincipal actor, User u, FirmMembership m) {
        if (actor.role() == Role.ROOT || actor.id().equals(u.getId()) || m == null) return;
        boolean elsewhere = membershipRepo.findByUserIdOrderByIdAsc(u.getId()).stream()
                .anyMatch(o -> o.isActive() && !o.getRealEstateFirmId().equals(m.getRealEstateFirmId()));
        if (elsewhere) {
            throw new ForbiddenException("This person also belongs to another reporting entity, so only they or"
                    + " a platform administrator can change their name or email");
        }
    }

    /**
     * Removes a user from the entity in view. Someone who belongs to no other entity loses the
     * account outright, as before; someone who does keeps it, and only this membership goes.
     */
    @Transactional
    public void delete(UserPrincipal actor, Long id, Long firmId) {
        User u = findById(id);
        if (u.getRole() == Role.ROOT) {
            throw new ForbiddenException("Administrator accounts can't be deleted");
        }
        Long contextFirm = actor.role().seesAllFirms()
                ? (firmId != null ? firmId : u.getRealEstateFirmId())
                : actor.realEstateFirmId();
        FirmMembership m = u.getRole().seesAllFirms() ? null
                : memberships.in(u.getId(), contextFirm)
                        .orElseThrow(() -> new NotFoundException("User " + id + " not found"));
        assertCanManage(actor, new Member(u, m));
        if (actor.id().equals(u.getId())) {
            throw new BadRequestException("You can't delete your own account");
        }
        boolean elsewhere = m != null && membershipRepo.findByUserIdOrderByIdAsc(u.getId()).stream()
                .anyMatch(o -> !o.getId().equals(m.getId()));
        if (elsewhere) {
            membershipRepo.delete(m);
            membershipRepo.flush();
            memberships.syncAccount(u);
            endSessions(u);
            return;
        }
        // Once the row is gone, JwtAuthenticationFilter finds no user and refuses their access
        // tokens; refresh tokens are revoked here so none can be renewed in the meantime (F6).
        refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        tokenStates.evictAfterCommit(u.getId());
        try {
            users.delete(u);
            users.flush(); // surface FK violations now rather than at commit
        } catch (DataIntegrityViolationException e) {
            throw new BadRequestException(
                    "This user owns deals or documents and can't be deleted — deactivate them instead");
        }
    }

    /**
     * Who an actor may edit/delete, judged on the target's membership in the actor's entity:
     *   ROOT        → anyone, except another ROOT account.
     *   firm-level  → members of their own firm, except firm-level peers (their own account is fine).
     *                 The firm-scoped mirror of the ROOT rule: peers appoint each other but can't
     *                 edit or remove one another, so no single officer can unseat the other.
     *   everyone else → no one.
     */
    private void assertCanManage(UserPrincipal actor, Member target) {
        User u = target.user();
        if (actor.role() == Role.ROOT) {
            if (u.getRole() == Role.ROOT && !actor.id().equals(u.getId())) {
                throw new ForbiddenException("Another administrator account can't be managed here");
            }
            return;
        }
        if (actor.role().isFirmLevel()) {
            if (target.firmId() == null || !target.firmId().equals(actor.realEstateFirmId())) {
                throw new ForbiddenException("This user is not in your firm");
            }
            if (target.role().isFirmLevel() && !actor.id().equals(u.getId())) {
                throw new ForbiddenException(
                        "Senior managers and compliance officers can't be edited or deleted here");
            }
            return;
        }
        if (actor.role() == Role.SALES_MANAGER) {
            if (target.branchId() == null || !target.branchId().equals(actor.firmBranchId())) {
                throw new ForbiddenException("This user is not in your branch");
            }
            // A sales manager may only manage the branch staff they can create (agents/admins).
            if (!actor.role().canCreate(target.role())) {
                throw new ForbiddenException("You can only manage agents in your branch");
            }
            return;
        }
        throw new ForbiddenException("You are not permitted to manage users");
    }

    /** Password management applies to ROOT only — all other roles are passwordless (email + OTP). */
    @Transactional
    public void resetPassword(Long id, String newPassword) {
        User u = findById(id);
        if (u.getRole() != Role.ROOT) {
            throw new BadRequestException("Only ROOT has a password; other users sign in with email + OTP");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        endSessions(u);
    }

    @Transactional
    public void changeOwnPassword(Long id, String currentPassword, String newPassword) {
        User u = findById(id);
        if (u.getPasswordHash() == null) {
            throw new BadRequestException("This account signs in with email + OTP and has no password");
        }
        if (!encoder.matches(currentPassword, u.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        endSessions(u);
    }

    /**
     * Ends every session the user holds, on every device, in the same transaction as the change
     * that calls for it (F2, F6):
     * <ul>
     *   <li>bumping the token version kills every access token already issued
     *       (JwtAuthenticationFilter compares it);</li>
     *   <li>revoking the refresh tokens stops any of them being renewed, so a stolen refresh cookie
     *       can't rotate itself into fresh sessions forever.</li>
     * </ul>
     * Called on a password change or reset, deactivation, and a role, firm or branch change. The
     * controller re-issues a session for the caller afterwards when the change was their own, so
     * they are not signed out by it.
     */
    private void endSessions(User u) {
        u.bumpTokenVersion();
        refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        tokenStates.evictAfterCommit(u.getId());
    }

    /**
     * Bind the new user into the creator's scope. ROOT can place firm-level users into any firm;
     * firm-level creators must keep new sales managers in their own firm; the sales manager must
     * keep new agents/admins in its own firm + branch.
     */
    private void bindCreationScope(UserPrincipal creator, Role targetRole, Long firmId, Long branchId) {
        if (creator.role() == Role.ROOT) {
            return; // ROOT assigns firm freely (validateFirmLinkage still checks the firm exists & is active)
        }
        if (creator.role().isFirmLevel()) {
            // An auditor spans every reporting entity, so only ROOT can appoint one. Said plainly
            // here — otherwise this falls into the firm check below and reports the wrong reason.
            if (targetRole == Role.AUDIT) {
                throw new ForbiddenException(
                        "Auditors see every reporting entity, so only a platform administrator may create one");
            }
            // Creating a firm-level peer, a FINANCE user or a SALES_MANAGER — either way, inside
            // the creator's own firm. This is the whole difference between them and ROOT.
            if (firmId == null || !firmId.equals(creator.realEstateFirmId())) {
                throw new ForbiddenException("You can only create users within your own firm");
            }
            return;
        }
        if (creator.role() == Role.SALES_MANAGER) {
            // Creating AGENT / AGENT_PA / ADMIN inside the creator's firm + branch.
            if (firmId == null || !firmId.equals(creator.realEstateFirmId())
                    || branchId == null || !branchId.equals(creator.firmBranchId())) {
                throw new ForbiddenException("You can only create users within your own branch");
            }
        }
    }

    /**
     * Per-tier linkage rules, driven entirely by Role.requiresFirm()/requiresBranch():
     *   ROOT / AUDIT                                     → firmId null, branchId null
     *   AML_COMPLIANCE_OFFICER / SENIOR_MANAGER / FINANCE → firmId required, branchId null
     *   SALES_MANAGER / AGENT / AGENT_PA / ADMIN          → firmId required, branchId required
     */
    private void validateFirmLinkage(Role role, Long firmId, Long branchId) {
        if (!role.requiresFirm()) {
            if (firmId != null) throw new BadRequestException(role + " must not have realEstateFirmId");
            if (branchId != null) throw new BadRequestException(role + " must not have firmBranchId");
            return;
        }
        requireFirm(firmId, role + " requires realEstateFirmId");
        requireActiveFirm(firmId);
        if (role.requiresBranch()) {
            requireBranch(branchId, role + " requires firmBranchId");
            requireBranchInFirm(branchId, firmId);
        } else if (branchId != null) {
            throw new BadRequestException(role + " must not have firmBranchId — they see every branch of their firm");
        }
    }

    private static void requireFirm(Long firmId, String message) {
        if (firmId == null) throw new BadRequestException(message);
    }

    private static void requireBranch(Long branchId, String message) {
        if (branchId == null) throw new BadRequestException(message);
    }

    private void requireActiveFirm(Long firmId) {
        RealEstateFirm firm = firms.findById(firmId)
                .orElseThrow(() -> new BadRequestException("Real-estate firm " + firmId + " not found"));
        if (!firm.isActive()) {
            throw new BadRequestException("Real-estate firm " + firmId + " is inactive");
        }
    }

    private void requireBranchInFirm(Long branchId, Long firmId) {
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));
        if (!branch.getRealEstateFirmId().equals(firmId)) {
            throw new BadRequestException("Branch " + branchId + " does not belong to firm " + firmId);
        }
        if (!branch.isActive()) {
            throw new BadRequestException("Branch " + branchId + " is inactive");
        }
    }
}
