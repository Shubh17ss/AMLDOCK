package nz.amldock.user;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.UpdateUserRequest;
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

    @Transactional(readOnly = true)
    public User findById(Long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    @Transactional
    public User create(CreateUserRequest req) {
        if (users.existsByEmailIgnoreCase(req.email())) {
            throw new BadRequestException("Email already in use");
        }
        validateFirmLinkage(req.role(), req.realEstateFirmId(), req.firmBranchId());

        User u = new User();
        u.setEmail(req.email().toLowerCase());
        u.setFullName(req.fullName());
        u.setRole(req.role());
        u.setRealEstateFirmId(req.realEstateFirmId());
        u.setFirmBranchId(req.firmBranchId());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setActive(true);
        return users.save(u);
    }

    @Transactional
    public User update(Long id, UpdateUserRequest req) {
        User u = findById(id);
        if (req.fullName() != null && !req.fullName().isBlank()) {
            u.setFullName(req.fullName());
        }
        // Role changes also reset the firm/branch linkage. If only the firm/branch
        // changes (role stays), the patch still re-validates after the new values land.
        if (req.role() != null) {
            u.setRole(req.role());
            u.setRealEstateFirmId(req.realEstateFirmId());
            u.setFirmBranchId(req.firmBranchId());
        } else {
            if (req.realEstateFirmId() != null || u.getRole() != Role.BROKER) {
                // For non-broker roles, allow explicit firm change. For broker, allow firm change too —
                // but a firm change without an accompanying branch change won't satisfy the constraint.
                if (req.realEstateFirmId() != null) u.setRealEstateFirmId(req.realEstateFirmId());
            }
            if (req.firmBranchId() != null) {
                u.setFirmBranchId(req.firmBranchId());
            }
        }
        if (req.active() != null) {
            u.setActive(req.active());
        }
        validateFirmLinkage(u.getRole(), u.getRealEstateFirmId(), u.getFirmBranchId());
        return u;
    }

    @Transactional
    public void resetPassword(Long id, String newPassword) {
        User u = findById(id);
        u.setPasswordHash(encoder.encode(newPassword));
    }

    @Transactional
    public void changeOwnPassword(Long id, String currentPassword, String newPassword) {
        User u = findById(id);
        if (!encoder.matches(currentPassword, u.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(newPassword));
    }

    /**
     * Per-role linkage rules:
     *   BROKER    → firmId required, branchId required, branch.firmId == firmId
     *   FIRM_USER → firmId required, branchId must be null (sees every branch of the firm)
     *   COMPLIANCE / MANAGER → neither set (internal staff)
     */
    private void validateFirmLinkage(Role role, Long firmId, Long branchId) {
        switch (role) {
            case BROKER -> {
                requireFirm(firmId, "BROKER requires realEstateFirmId");
                requireBranch(branchId, "BROKER requires firmBranchId");
                requireActiveFirm(firmId);
                requireBranchInFirm(branchId, firmId);
            }
            case FIRM_USER -> {
                requireFirm(firmId, "FIRM_USER requires realEstateFirmId");
                if (branchId != null) {
                    throw new BadRequestException("FIRM_USER must not have firmBranchId — they see every branch of their firm");
                }
                requireActiveFirm(firmId);
            }
            case COMPLIANCE, MANAGER -> {
                if (firmId != null) {
                    throw new BadRequestException(role + " must not have realEstateFirmId");
                }
                if (branchId != null) {
                    throw new BadRequestException(role + " must not have firmBranchId");
                }
            }
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
