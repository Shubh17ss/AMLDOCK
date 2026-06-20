package nz.amldock.firm;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.dto.CreateFirmRequest;
import nz.amldock.firm.dto.UpdateFirmRequest;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserOnboarding;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserService;
import nz.amldock.user.dto.CreateUserRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FirmService {

    /** Guard rail so a typo'd branch count can't spawn an unbounded number of rows. */
    private static final int MAX_AUTO_BRANCHES = 100;

    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;
    private final UserService userService;
    private final UserOnboarding onboarding;

    public FirmService(RealEstateFirmRepository firms,
                       FirmBranchRepository branches,
                       UserService userService,
                       UserOnboarding onboarding) {
        this.firms = firms;
        this.branches = branches;
        this.userService = userService;
        this.onboarding = onboarding;
    }

    @Transactional(readOnly = true)
    public List<RealEstateFirm> listVisible() {
        UserPrincipal principal = currentPrincipal();
        // Everyone except ROOT is scoped to their own firm.
        if (principal != null && principal.role() != Role.ROOT && principal.realEstateFirmId() != null) {
            return firms.findById(principal.realEstateFirmId())
                    .map(List::of)
                    .orElseGet(List::of);
        }
        return firms.findAllByOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public RealEstateFirm findById(Long id) {
        RealEstateFirm f = firms.findById(id)
                .orElseThrow(() -> new NotFoundException("Firm " + id + " not found"));
        assertVisible(f.getId());
        return f;
    }

    /**
     * Onboard a firm in one step: create the firm record, pre-create the requested number of
     * placeholder branches, and provision a SENIOR_MANAGER login for the firm (passwordless, gets
     * an OTP welcome email). All in one transaction — if any part fails (e.g. the senior-manager
     * email is already in use) the whole onboarding rolls back.
     */
    @Transactional
    public RealEstateFirm create(CreateFirmRequest req) {
        if (firms.existsByNameIgnoreCase(req.name())) {
            throw new BadRequestException("Firm name already in use");
        }
        String nzbn = blankToNull(req.nzbn());
        if (nzbn != null && firms.existsByNzbnIgnoreCase(nzbn)) {
            throw new BadRequestException("NZBN/ABN already in use");
        }
        RealEstateFirm f = new RealEstateFirm();
        f.setName(req.name());
        f.setNzbn(nzbn);
        f.setLiaisonName(req.liaisonName());
        f.setLiaisonEmail(req.liaisonEmail());
        f.setLiaisonContactNumber(req.liaisonContactNumber());
        f.setSeniorManagerName(req.seniorManagerName());
        f.setSeniorManagerEmail(req.seniorManagerEmail());
        f.setSeniorManagerContactNumber(req.seniorManagerContactNumber());
        f.setNumberOfBranches(req.numberOfBranches());
        f.setActive(true);
        RealEstateFirm saved = firms.save(f);

        createPlaceholderBranches(saved.getId(), req.numberOfBranches());
        provisionSeniorManager(saved.getId(), req.seniorManagerName(), req.seniorManagerEmail());
        return saved;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private void createPlaceholderBranches(Long firmId, Integer count) {
        int n = count == null ? 0 : Math.min(Math.max(count, 0), MAX_AUTO_BRANCHES);
        for (int i = 1; i <= n; i++) {
            FirmBranch b = new FirmBranch();
            b.setRealEstateFirmId(firmId);
            b.setName("Branch " + i);
            b.setActive(true);
            branches.save(b);
        }
    }

    private void provisionSeniorManager(Long firmId, String name, String email) {
        // The actor is ROOT (firm creation is ROOT-only); UserService enforces that ROOT may
        // create a SENIOR_MANAGER and validates firm linkage. Name falls back to the email.
        String fullName = (name == null || name.isBlank()) ? email : name;
        CreateUserRequest smReq = new CreateUserRequest(email, fullName, Role.SENIOR_MANAGER, firmId, null);
        User sm = userService.create(currentPrincipal(), smReq);
        onboarding.sendWelcome(sm);
    }

    @Transactional
    public RealEstateFirm update(Long id, UpdateFirmRequest req) {
        RealEstateFirm f = firms.findById(id)
                .orElseThrow(() -> new NotFoundException("Firm " + id + " not found"));
        UserPrincipal actor = currentPrincipal();
        boolean isRoot = actor != null && actor.role() == Role.ROOT;
        if (!isRoot) {
            // Firm-level managers may only touch their own firm…
            assertVisible(id);
        }
        // …and the firm name, NZBN/ABN, and active flag are platform-admin-only (immutable here).
        if (isRoot) {
            if (req.name() != null && !req.name().isBlank() && !req.name().equalsIgnoreCase(f.getName())) {
                if (firms.existsByNameIgnoreCaseAndIdNot(req.name(), f.getId())) {
                    throw new BadRequestException("Firm name already in use");
                }
                f.setName(req.name());
            }
            if (req.nzbn() != null) {
                String nzbn = blankToNull(req.nzbn());
                if (nzbn != null && firms.existsByNzbnIgnoreCaseAndIdNot(nzbn, f.getId())) {
                    throw new BadRequestException("NZBN/ABN already in use");
                }
                f.setNzbn(nzbn);
            }
            if (req.active() != null) f.setActive(req.active());
        }
        if (req.liaisonName() != null) f.setLiaisonName(req.liaisonName());
        if (req.liaisonEmail() != null) f.setLiaisonEmail(req.liaisonEmail());
        if (req.liaisonContactNumber() != null) f.setLiaisonContactNumber(req.liaisonContactNumber());
        if (req.seniorManagerName() != null) f.setSeniorManagerName(req.seniorManagerName());
        if (req.seniorManagerEmail() != null) f.setSeniorManagerEmail(req.seniorManagerEmail());
        if (req.seniorManagerContactNumber() != null) f.setSeniorManagerContactNumber(req.seniorManagerContactNumber());
        if (req.numberOfBranches() != null) f.setNumberOfBranches(req.numberOfBranches());
        return f;
    }

    /** Throws if a non-ROOT user tries to access a firm other than their own. */
    public void assertVisible(Long firmId) {
        UserPrincipal principal = currentPrincipal();
        if (principal != null
                && principal.role() != Role.ROOT
                && principal.realEstateFirmId() != null
                && !firmId.equals(principal.realEstateFirmId())) {
            throw new ForbiddenException("Access to firm " + firmId + " denied");
        }
    }

    private UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) {
            return up;
        }
        return null;
    }
}
