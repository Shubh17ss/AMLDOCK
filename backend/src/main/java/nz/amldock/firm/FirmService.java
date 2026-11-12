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
import java.util.Locale;
import java.util.Set;

@Service
public class FirmService {

    /** Guard rail so a typo'd branch count can't spawn an unbounded number of rows. */
    private static final int MAX_AUTO_BRANCHES = 100;

    /**
     * The jurisdictions the platform operates in, as ISO 3166-1 alpha-2. The CHECK constraint on
     * real_estate_firm.country backs this up; validating here is what produces a readable 400
     * instead of a constraint violation.
     */
    private static final Set<String> SUPPORTED_COUNTRIES = Set.of("NZ", "AU");

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
        // Everyone except ROOT and AUDIT is scoped to their own firm.
        if (principal != null && !principal.role().seesAllFirms() && principal.realEstateFirmId() != null) {
            return firms.findById(principal.realEstateFirmId())
                    .map(List::of)
                    .orElseGet(List::of);
        }
        return firms.findAllByOrderByNameAsc();
    }

    /**
     * The internal id for a public id, or a 404. A numeric id, or anything else that is not a
     * well-formed public id, is a 404 without a query — the old sequential URLs name nothing now.
     * Visibility is still the caller's to check, as it is for a numeric id.
     */
    @Transactional(readOnly = true)
    public Long resolve(String publicId) {
        if (!FirmPublicIds.isWellFormed(publicId)) throw new NotFoundException("Firm " + publicId + " not found");
        return firms.findByPublicId(publicId)
                .map(RealEstateFirm::getId)
                .orElseThrow(() -> new NotFoundException("Firm " + publicId + " not found"));
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
     * placeholder branches, and provision an AML_COMPLIANCE_OFFICER login for the firm
     * (passwordless, gets an OTP welcome email). All in one transaction — if any part fails (e.g.
     * the compliance-officer email is already in use) the whole onboarding rolls back.
     */
    @Transactional
    public RealEstateFirm create(CreateFirmRequest req) {
        if (firms.existsByNameIgnoreCase(req.name())) {
            throw new BadRequestException("Firm name already in use");
        }
        String nzbn = blankToNull(req.nzbn());
        String country = normaliseCountry(req.country());
        // Unique within a country: the same number may belong to an NZ and an AU entity, since
        // NZBNs and ABNs are issued by different registers.
        if (nzbn != null && firms.existsByCountryAndNzbnIgnoreCase(country, nzbn)) {
            throw new BadRequestException(duplicateNzbn(country, nzbn));
        }
        RealEstateFirm f = new RealEstateFirm();
        f.setName(req.name());
        f.setNzbn(nzbn);
        f.setCountry(country);
        f.setLiaisonName(req.liaisonName());
        f.setLiaisonEmail(req.liaisonEmail());
        f.setLiaisonContactNumber(req.liaisonContactNumber());
        f.setComplianceOfficerName(req.complianceOfficerName());
        f.setComplianceOfficerEmail(req.complianceOfficerEmail());
        f.setComplianceOfficerContactNumber(req.complianceOfficerContactNumber());
        f.setNumberOfBranches(req.numberOfBranches());
        f.setActive(true);
        RealEstateFirm saved = firms.save(f);

        createPlaceholderBranches(saved.getId(), req.numberOfBranches());
        provisionComplianceOfficer(saved.getId(), req.complianceOfficerName(), req.complianceOfficerEmail());
        return saved;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** Upper-cases and checks an ISO code against the jurisdictions the platform supports. */
    private static String duplicateNzbn(String country, String nzbn) {
        String label = "AU".equals(country) ? "ABN" : "NZBN";
        return "Another " + country + " reporting entity already uses " + label + " " + nzbn;
    }

    private static String normaliseCountry(String code) {
        String normalised = code == null ? null : code.trim().toUpperCase(Locale.ROOT);
        if (normalised == null || !SUPPORTED_COUNTRIES.contains(normalised)) {
            throw new BadRequestException("Country must be one of " + SUPPORTED_COUNTRIES);
        }
        return normalised;
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

    private void provisionComplianceOfficer(Long firmId, String name, String email) {
        // The actor is ROOT (firm creation is ROOT-only); UserService enforces that ROOT may
        // create an AML_COMPLIANCE_OFFICER and validates firm linkage — that role wants a firm and
        // no branch, which is exactly what's passed. Name falls back to the email.
        String fullName = (name == null || name.isBlank()) ? email : name;
        CreateUserRequest coReq = new CreateUserRequest(
                email, fullName, Role.AML_COMPLIANCE_OFFICER, firmId, null);
        // An address that already serves another entity as a compliance officer or senior manager
        // is added to this one rather than refused; see UserService.create.
        UserService.Created created = userService.create(currentPrincipal(), coReq);
        if (created.existingAccount()) {
            onboarding.sendAddedToEntity(created.member().user(), firmId, Role.AML_COMPLIANCE_OFFICER);
        } else {
            onboarding.sendWelcome(created.member().user());
        }
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
        // …and the firm name, NZBN/ABN, country and active flag are platform-admin-only.
        if (isRoot) {
            if (req.country() != null) f.setCountry(normaliseCountry(req.country()));
            if (req.name() != null && !req.name().isBlank() && !req.name().equalsIgnoreCase(f.getName())) {
                if (firms.existsByNameIgnoreCaseAndIdNot(req.name(), f.getId())) {
                    throw new BadRequestException("Firm name already in use");
                }
                f.setName(req.name());
            }
            // Checked against the pair as it will stand, so moving an entity to another country
            // is refused just as a clashing number is.
            String nzbn = req.nzbn() != null ? blankToNull(req.nzbn()) : f.getNzbn();
            if (nzbn != null && firms.existsByCountryAndNzbnIgnoreCaseAndIdNot(f.getCountry(), nzbn, f.getId())) {
                throw new BadRequestException(duplicateNzbn(f.getCountry(), nzbn));
            }
            f.setNzbn(nzbn);
            if (req.active() != null) f.setActive(req.active());
        }
        if (req.liaisonName() != null) f.setLiaisonName(req.liaisonName());
        if (req.liaisonEmail() != null) f.setLiaisonEmail(req.liaisonEmail());
        if (req.liaisonContactNumber() != null) f.setLiaisonContactNumber(req.liaisonContactNumber());
        if (req.complianceOfficerName() != null) f.setComplianceOfficerName(req.complianceOfficerName());
        if (req.complianceOfficerEmail() != null) f.setComplianceOfficerEmail(req.complianceOfficerEmail());
        if (req.complianceOfficerContactNumber() != null) f.setComplianceOfficerContactNumber(req.complianceOfficerContactNumber());
        if (req.numberOfBranches() != null && !req.numberOfBranches().equals(f.getNumberOfBranches())) {
            // The declared count is the platform's to set: it is the ceiling on what the firm may
            // operate. Refused rather than ignored, so a screen that offers it cannot drift.
            if (!isRoot) throw new ForbiddenException("Only ROOT can change the number of branches");
            // The declared count is the ceiling BranchService enforces, so it must not be set
            // below the branches the firm already operates — that would strand existing rows
            // above the limit. Deactivate them first.
            long activeCount = countActiveBranches(f.getId());
            if (req.numberOfBranches() < activeCount) {
                throw new BadRequestException(
                        "This firm has " + activeCount + " active branch(es); deactivate branches "
                                + "before lowering the declared count to " + req.numberOfBranches() + ".");
            }
            f.setNumberOfBranches(req.numberOfBranches());
        }
        return f;
    }

    /**
     * Branches a firm currently operates. Deactivated branches don't count against its declared
     * limit. Callers are already transactional, so this carries no annotation of its own.
     */
    public long countActiveBranches(Long firmId) {
        return branches.findAllByRealEstateFirmIdOrderByNameAsc(firmId).stream()
                .filter(FirmBranch::isActive)
                .count();
    }

    /** Throws if a firm-scoped user tries to access a firm other than their own. */
    public void assertVisible(Long firmId) {
        UserPrincipal principal = currentPrincipal();
        if (principal != null
                && !principal.role().seesAllFirms()
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
