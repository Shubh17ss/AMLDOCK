package nz.amldock.firm;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.dto.CreateBranchRequest;
import nz.amldock.firm.dto.UpdateBranchRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BranchService {

    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final FirmService firmService;

    public BranchService(FirmBranchRepository branches,
                         RealEstateFirmRepository firms,
                         FirmService firmService) {
        this.branches = branches;
        this.firms = firms;
        this.firmService = firmService;
    }

    @Transactional(readOnly = true)
    public List<FirmBranch> listByFirm(Long firmId) {
        if (!firms.existsById(firmId)) {
            throw new NotFoundException("Firm " + firmId + " not found");
        }
        firmService.assertVisible(firmId);
        return branches.findAllByRealEstateFirmIdOrderByNameAsc(firmId);
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
        if (req.active() != null) b.setActive(req.active());
        return b;
    }

    @Transactional
    public void deactivate(Long id) {
        FirmBranch b = branches.findById(id)
                .orElseThrow(() -> new NotFoundException("Branch " + id + " not found"));
        firmService.assertVisible(b.getRealEstateFirmId());
        b.setActive(false);
    }
}
