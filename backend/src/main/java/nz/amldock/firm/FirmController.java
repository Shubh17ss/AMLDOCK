package nz.amldock.firm;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.firm.dto.BranchDto;
import nz.amldock.firm.dto.CreateBranchRequest;
import nz.amldock.firm.dto.CreateFirmRequest;
import nz.amldock.firm.dto.FirmDto;
import nz.amldock.firm.dto.UpdateFirmRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/firms")
public class FirmController {

    private final FirmService firms;
    private final BranchService branches;
    private final AuditService audit;

    public FirmController(FirmService firms, BranchService branches, AuditService audit) {
        this.firms = firms;
        this.branches = branches;
        this.audit = audit;
    }

    @GetMapping
    public List<FirmDto> list() {
        return firms.listVisible().stream().map(FirmDto::from).toList();
    }

    @GetMapping("/{id}")
    public FirmDto get(@PathVariable Long id) {
        return FirmDto.from(firms.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('MANAGER')")
    public FirmDto create(@Valid @RequestBody CreateFirmRequest req) {
        RealEstateFirm f = firms.create(req);
        audit.record(AuditAction.FIRM_CREATED, "RealEstateFirm", f.getId(), "Created firm " + f.getName());
        return FirmDto.from(f);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public FirmDto update(@PathVariable Long id, @RequestBody UpdateFirmRequest req) {
        RealEstateFirm f = firms.update(id, req);
        audit.record(AuditAction.FIRM_UPDATED, "RealEstateFirm", f.getId(), "Updated firm " + f.getName());
        return FirmDto.from(f);
    }

    @GetMapping("/{id}/branches")
    public List<BranchDto> listBranches(@PathVariable Long id) {
        return branches.listByFirm(id).stream().map(BranchDto::from).toList();
    }

    @PostMapping("/{id}/branches")
    @PreAuthorize("hasRole('MANAGER')")
    public BranchDto createBranch(@PathVariable Long id, @Valid @RequestBody CreateBranchRequest req) {
        FirmBranch b = branches.create(id, req);
        audit.record(AuditAction.BRANCH_CREATED, "FirmBranch", b.getId(),
                "Created branch " + b.getName() + " for firm " + id);
        return BranchDto.from(b);
    }
}
