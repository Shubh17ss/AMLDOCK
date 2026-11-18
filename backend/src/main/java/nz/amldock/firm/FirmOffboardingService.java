package nz.amldock.firm;

import nz.amldock.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deactivating and reactivating a reporting entity. Its own service because it drives
 * BranchService, which already depends on FirmService.
 *
 * <p>Deactivating an entity deactivates every branch still active in it (cause FIRM), which signs
 * their staff out. Its compliance officers and senior managers keep read-only access: their
 * memberships stay on, and InactiveScopeReadOnlyFilter refuses their writes. Reactivating brings
 * back the branches it closed, and through them their staff — not a branch someone had closed by
 * hand before.
 */
@Service
public class FirmOffboardingService {

    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;
    private final FirmService firmService;
    private final BranchService branchService;

    public FirmOffboardingService(RealEstateFirmRepository firms, FirmBranchRepository branches,
                                  FirmService firmService, BranchService branchService) {
        this.firms = firms;
        this.branches = branches;
        this.firmService = firmService;
        this.branchService = branchService;
    }

    @Transactional
    public RealEstateFirm deactivate(Long firmId) {
        RealEstateFirm f = load(firmId);
        if (!f.isActive()) return f;
        f.setActive(false);
        for (FirmBranch b : branches.findAllByRealEstateFirmIdOrderByNameAsc(firmId)) {
            if (b.isActive()) branchService.deactivate(b.getId(), DeactivationSource.FIRM);
        }
        return f;
    }

    @Transactional
    public RealEstateFirm activate(Long firmId) {
        RealEstateFirm f = load(firmId);
        if (f.isActive()) return f;
        // BranchService.activate reads this same managed entity, so it sees it active.
        f.setActive(true);
        for (FirmBranch b : branches.findAllByRealEstateFirmIdOrderByNameAsc(firmId)) {
            if (!b.isActive() && b.getDeactivationSource() == DeactivationSource.FIRM) {
                branchService.activate(b.getId());
            }
        }
        return f;
    }

    private RealEstateFirm load(Long firmId) {
        RealEstateFirm f = firms.findById(firmId)
                .orElseThrow(() -> new NotFoundException("Firm " + firmId + " not found"));
        firmService.assertVisible(firmId);
        return f;
    }
}
