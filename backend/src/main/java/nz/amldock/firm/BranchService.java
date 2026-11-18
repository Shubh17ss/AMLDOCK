package nz.amldock.firm;

import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.dto.CreateBranchRequest;
import nz.amldock.firm.dto.UpdateBranchRequest;
import nz.amldock.user.MembershipService;
import nz.amldock.user.User;
import nz.amldock.user.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BranchService {

    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final FirmService firmService;
    private final MembershipService memberships;
    private final UserService users;

    public BranchService(FirmBranchRepository branches,
                         RealEstateFirmRepository firms,
                         FirmService firmService,
                         MembershipService memberships,
                         UserService users) {
        this.branches = branches;
        this.firms = firms;
        this.firmService = firmService;
        this.memberships = memberships;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<FirmBranch> listByFirm(Long firmId) {
        if (!firms.existsById(firmId)) {
            throw new NotFoundException("Firm " + firmId + " not found");
        }
        firmService.assertVisible(firmId);
        return branches.findAllByRealEstateFirmIdOrderByNameAsc(firmId);
    }

    /** The internal id for a branch's public id, or a 404. See {@link FirmService#resolve}. */
    @Transactional(readOnly = true)
    public Long resolve(String publicId) {
        if (!FirmPublicIds.isWellFormed(publicId)) throw new NotFoundException("Branch " + publicId + " not found");
        return branches.findByPublicId(publicId)
                .map(FirmBranch::getId)
                .orElseThrow(() -> new NotFoundException("Branch " + publicId + " not found"));
    }

    @Transactional(readOnly = true)
    public FirmBranch findById(Long id) {
        FirmBranch b = branches.findById(id)
                .orElseThrow(() -> new NotFoundException("Branch " + id + " not found"));
        firmService.assertVisible(b.getRealEstateFirmId());
        return b;
    }

    @Transactional
    public FirmBranch create(Long firmId, CreateBranchRequest req) {
        RealEstateFirm firm = firms.findById(firmId)
                .orElseThrow(() -> new NotFoundException("Firm " + firmId + " not found"));
        firmService.assertVisible(firmId);
        if (!firm.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    firm.getName() + " is deactivated — reactivate it before adding branches");
        }
        // The firm declares how many branches it operates; adding beyond that is a data error.
        // Only active branches count, so deactivating one frees its slot.
        Integer declared = firm.getNumberOfBranches();
        if (declared != null && firmService.countActiveBranches(firmId) >= declared) {
            throw new BadRequestException(
                    "This firm declares " + declared + " branch(es); deactivate one or raise the "
                            + "branch count in Firm details before adding another.");
        }
        branches.findByRealEstateFirmIdAndNameIgnoreCase(firmId, req.name())
                .ifPresent(b -> { throw new BadRequestException("Branch name already in use for this firm"); });
        FirmBranch b = new FirmBranch();
        b.setRealEstateFirmId(firmId);
        b.setName(req.name());
        b.setAddressLine1(req.addressLine1());
        b.setAddressLine2(req.addressLine2());
        b.setSuburb(req.suburb());
        b.setCity(req.city());
        b.setPostcode(req.postcode());
        b.setPhone(req.phone());
        b.setEmail(req.email());
        b.setManagerName(req.managerName());
        b.setManagerEmail(req.managerEmail());
        b.setActive(true);
        return branches.save(b);
    }

    @Transactional
    public FirmBranch update(Long id, UpdateBranchRequest req) {
        FirmBranch b = branches.findById(id)
                .orElseThrow(() -> new NotFoundException("Branch " + id + " not found"));
        firmService.assertVisible(b.getRealEstateFirmId());
        if (!b.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Branch " + b.getName() + " is deactivated — reactivate it before changing its details");
        }
        if (req.name() != null && !req.name().isBlank() && !req.name().equalsIgnoreCase(b.getName())) {
            branches.findByRealEstateFirmIdAndNameIgnoreCase(b.getRealEstateFirmId(), req.name())
                    .ifPresent(existing -> { throw new BadRequestException("Branch name already in use for this firm"); });
            b.setName(req.name());
        }
        if (req.addressLine1() != null) b.setAddressLine1(req.addressLine1());
        if (req.addressLine2() != null) b.setAddressLine2(req.addressLine2());
        if (req.suburb() != null) b.setSuburb(req.suburb());
        if (req.city() != null) b.setCity(req.city());
        if (req.postcode() != null) b.setPostcode(req.postcode());
        if (req.phone() != null) b.setPhone(req.phone());
        if (req.email() != null) b.setEmail(req.email());
        if (req.managerName() != null) b.setManagerName(req.managerName());
        if (req.managerEmail() != null) b.setManagerEmail(req.managerEmail());
        return b;
    }

    /**
     * Off-boards a branch: it goes read-only (ScopeStatusGuard) and its retention hold starts
     * (RetentionPolicy). Everyone whose membership is in it is switched off and signed out at
     * once; firm-level staff keep read access through their entity. Already off is a no-op, so a
     * branch someone closed by hand keeps its MANUAL cause when its entity closes too.
     */
    @Transactional
    public FirmBranch deactivate(Long id, DeactivationSource source) {
        FirmBranch b = findById(id);
        if (!b.isActive()) return b;
        b.deactivate(source);
        for (User u : memberships.deactivateInBranch(id, DeactivationSource.BRANCH)) {
            users.endSessions(u);
        }
        return b;
    }

    /**
     * Brings a branch back, and with it the members its deactivation switched off — not those a
     * manager had switched off by hand. Its entity must be active, and it takes one of the branch
     * slots the entity declares, as a new branch would.
     */
    @Transactional
    public FirmBranch activate(Long id) {
        FirmBranch b = findById(id);
        if (b.isActive()) return b;
        RealEstateFirm firm = firms.findById(b.getRealEstateFirmId())
                .orElseThrow(() -> new NotFoundException("Firm " + b.getRealEstateFirmId() + " not found"));
        if (!firm.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    firm.getName() + " is deactivated — reactivate the reporting entity first");
        }
        Integer declared = firm.getNumberOfBranches();
        if (declared != null && firmService.countActiveBranches(firm.getId()) >= declared) {
            throw new BadRequestException(
                    "This firm declares " + declared + " branch(es); deactivate one or raise the "
                            + "branch count in Firm details before reactivating this one.");
        }
        b.activate();
        memberships.reactivateInBranch(id, DeactivationSource.BRANCH);
        return b;
    }
}
