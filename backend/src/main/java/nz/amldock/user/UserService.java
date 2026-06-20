package nz.amldock.user;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.UpdateUserRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository users;
    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;
    private final PasswordEncoder encoder;

    public UserService(UserRepository users,
                       RealEstateFirmRepository firms,
                       FirmBranchRepository branches,
                       PasswordEncoder encoder) {
        this.users = users;
        this.firms = firms;
        this.branches = branches;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public List<User> findAll() {
        return users.findAll();
    }

    /** Users the actor is allowed to see, scoped to their tier. */
    @Transactional(readOnly = true)
    public List<User> findVisible(UserPrincipal actor) {
        Role role = actor.role();
        if (role == Role.ROOT) {
            return users.findAll();
        }
        if (role.isFirmLevel()) {
            return users.findByRealEstateFirmId(actor.realEstateFirmId());
        }
        if (role == Role.SALES_MANAGER) {
            return users.findByFirmBranchId(actor.firmBranchId());
        }
        // Agents / branch admins don't manage users.
        return List.of();
    }

    @Transactional(readOnly = true)
    public User findById(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    /**
     * Create a user below the actor in the hierarchy. Enforces:
     *   1. the actor may create the requested role (top tier creates the tier below, never otherwise);
     *   2. firm/branch linkage matches the target role's tier;
     *   3. the new user lands within the actor's own scope (firm for firm-level creators,
     *      firm + branch for the sales manager).
     */
    @Transactional
    public User create(UserPrincipal creator, CreateUserRequest req) {
        if (!creator.role().canCreate(req.role())) {
            throw new ForbiddenException(creator.role() + " is not permitted to create " + req.role() + " users");
        }
        if (users.existsByEmailIgnoreCase(req.email())) {
            throw new BadRequestException("Email already in use");
        }

        Long firmId = req.realEstateFirmId();
        Long branchId = req.firmBranchId();
        bindCreationScope(creator, req.role(), firmId, branchId);
        validateFirmLinkage(req.role(), firmId, branchId);

        User u = new User();
        u.setEmail(req.email().toLowerCase());
        u.setFullName(req.fullName());
        u.setRole(req.role());
        u.setRealEstateFirmId(firmId);
        u.setFirmBranchId(branchId);
        // Passwordless: these users sign in with email + OTP.
        u.setActive(true);
        return users.save(u);
    }

    @Transactional
    public User update(UserPrincipal actor, Long id, UpdateUserRequest req) {
        User u = findById(id);
        assertCanManage(actor, u);
        boolean isRoot = actor.role() == Role.ROOT;

        if (req.fullName() != null && !req.fullName().isBlank()) {
            u.setFullName(req.fullName());
        }
        if (req.email() != null && !req.email().isBlank() && !req.email().equalsIgnoreCase(u.getEmail())) {
            if (users.existsByEmailIgnoreCaseAndIdNot(req.email(), u.getId())) {
                throw new BadRequestException("Email already in use");
            }
            u.setEmail(req.email().toLowerCase());
        }
        // Role / firm / branch / active are platform-admin concerns — firm-level managers may
        // only edit name + email of the users in their firm.
        if (isRoot) {
            if (req.role() != null) {
                u.setRole(req.role());
                u.setRealEstateFirmId(req.realEstateFirmId());
                u.setFirmBranchId(req.firmBranchId());
            } else {
                if (req.realEstateFirmId() != null) u.setRealEstateFirmId(req.realEstateFirmId());
                if (req.firmBranchId() != null) u.setFirmBranchId(req.firmBranchId());
            }
            if (req.active() != null) {
                u.setActive(req.active());
            }
        }
        validateFirmLinkage(u.getRole(), u.getRealEstateFirmId(), u.getFirmBranchId());
        return u;
    }

    @Transactional
    public void delete(UserPrincipal actor, Long id) {
        User u = findById(id);
        assertCanManage(actor, u);
        if (u.getRole() == Role.ROOT) {
            throw new ForbiddenException("Administrator accounts can't be deleted");
        }
        if (actor.id().equals(u.getId())) {
            throw new BadRequestException("You can't delete your own account");
        }
        try {
            users.delete(u);
            users.flush(); // surface FK violations now rather than at commit
        } catch (DataIntegrityViolationException e) {
            throw new BadRequestException(
                    "This user owns deals or documents and can't be deleted — deactivate them instead");
        }
    }

    /**
     * Who an actor may edit/delete:
     *   ROOT        → anyone, except another ROOT account.
     *   firm-level  → users in their own firm, except senior-manager / compliance-officer peers.
     *   everyone else → no one.
     */
    private void assertCanManage(UserPrincipal actor, User target) {
        if (actor.role() == Role.ROOT) {
            if (target.getRole() == Role.ROOT && !actor.id().equals(target.getId())) {
                throw new ForbiddenException("Another administrator account can't be managed here");
            }
            return;
        }
        if (actor.role().isFirmLevel()) {
            if (target.getRealEstateFirmId() == null
                    || !target.getRealEstateFirmId().equals(actor.realEstateFirmId())) {
                throw new ForbiddenException("This user is not in your firm");
            }
            if (target.getRole() == Role.SENIOR_MANAGER || target.getRole() == Role.AML_COMPLIANCE_OFFICER) {
                throw new ForbiddenException(
                        "Senior managers and compliance officers can't be edited or deleted here");
            }
            return;
        }
        if (actor.role() == Role.SALES_MANAGER) {
            if (target.getFirmBranchId() == null || !target.getFirmBranchId().equals(actor.firmBranchId())) {
                throw new ForbiddenException("This user is not in your branch");
            }
            // A sales manager may only manage the branch staff they can create (agents/admins).
            if (!actor.role().canCreate(target.getRole())) {
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
            // Creating a SALES_MANAGER inside the creator's firm.
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
     * Per-tier linkage rules:
     *   ROOT                                   → firmId null, branchId null
     *   AML_COMPLIANCE_OFFICER / SENIOR_MANAGER → firmId required, branchId null
     *   SALES_MANAGER / AGENT / AGENT_PA / ADMIN → firmId required, branchId required (branch in firm)
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
