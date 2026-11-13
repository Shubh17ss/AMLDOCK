package nz.amldock.firm;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.firm.dto.BranchDto;
import nz.amldock.firm.dto.ConfirmDeleteRequest;
import nz.amldock.firm.dto.CreateBranchRequest;
import nz.amldock.firm.dto.CreateFirmRequest;
import nz.amldock.firm.dto.FirmDto;
import nz.amldock.firm.dto.UpdateFirmRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Firms are named in paths by their public id ({@link FirmPublicIds}); the numeric id stays in the
 * DTOs because the other APIs still filter by it.
 */
@RestController
@RequestMapping("/api/firms")
public class FirmController {

    private final FirmService firms;
    private final BranchService branches;
    private final FirmOffboardingService offboarding;
    private final FirmDeletionService deletion;
    private final AuditService audit;

    public FirmController(FirmService firms, BranchService branches, FirmOffboardingService offboarding,
                          FirmDeletionService deletion, AuditService audit) {
        this.firms = firms;
        this.branches = branches;
        this.offboarding = offboarding;
        this.deletion = deletion;
        this.audit = audit;
    }

    @GetMapping
    public List<FirmDto> list() {
        return firms.listVisible().stream().map(FirmDto::from).toList();
    }

    @GetMapping("/{ref}")
    public FirmDto get(@PathVariable String ref) {
        return FirmDto.from(firms.findById(firms.resolve(ref)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ROOT')")
    public FirmDto create(@Valid @RequestBody CreateFirmRequest req) {
        RealEstateFirm f = firms.create(req);
        audit.record(AuditAction.FIRM_CREATED, "RealEstateFirm", f.getId(), "Created firm " + f.getName());
        return FirmDto.from(f);
    }

    @PatchMapping("/{ref}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
    public FirmDto update(@PathVariable String ref, @RequestBody UpdateFirmRequest req) {
        RealEstateFirm f = firms.update(firms.resolve(ref), req);
        audit.record(AuditAction.FIRM_UPDATED, "RealEstateFirm", f.getId(), "Updated firm " + f.getName());
        return FirmDto.from(f);
    }

    @GetMapping("/{ref}/branches")
    public List<BranchDto> listBranches(@PathVariable String ref) {
        return branches.listByFirm(firms.resolve(ref)).stream().map(BranchDto::from).toList();
    }

    @PostMapping("/{ref}/branches")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
    public BranchDto createBranch(@PathVariable String ref, @Valid @RequestBody CreateBranchRequest req) {
        FirmBranch b = branches.create(firms.resolve(ref), req);
        audit.record(AuditAction.BRANCH_CREATED, "FirmBranch", b.getId(),
                "Created branch " + b.getName() + " for firm " + ref);
        return BranchDto.from(b);
    }

    /* ---------- off-boarding (ROOT only) ---------- */

    @PostMapping("/{ref}/deactivate")
    @PreAuthorize("hasRole('ROOT')")
    public FirmDto deactivate(@PathVariable String ref) {
        RealEstateFirm f = offboarding.deactivate(firms.resolve(ref));
        audit.record(AuditAction.FIRM_DEACTIVATED, "RealEstateFirm", f.getId(), "Deactivated firm " + f.getName());
        return FirmDto.from(f);
    }

    @PostMapping("/{ref}/activate")
    @PreAuthorize("hasRole('ROOT')")
    public FirmDto activate(@PathVariable String ref) {
        RealEstateFirm f = offboarding.activate(firms.resolve(ref));
        audit.record(AuditAction.FIRM_ACTIVATED, "RealEstateFirm", f.getId(), "Reactivated firm " + f.getName());
        return FirmDto.from(f);
    }

    @GetMapping("/{ref}/deletion-preview")
    @PreAuthorize("hasRole('ROOT')")
    public FirmDeletionService.Preview deletionPreview(@PathVariable String ref) {
        return deletion.preview(firms.resolve(ref));
    }

    /** Irreversible. The body carries the entity's name, typed out by the person confirming. */
    @DeleteMapping("/{ref}")
    @PreAuthorize("hasRole('ROOT')")
    public ResponseEntity<Void> delete(@PathVariable String ref, @RequestBody ConfirmDeleteRequest req) {
        Long id = firms.resolve(ref);
        FirmDeletionService.Preview gone = deletion.delete(id, req.confirmName());
        audit.record(AuditAction.FIRM_DELETED, "RealEstateFirm", id,
                "Deleted firm " + gone.firmName() + " (" + ref + ") with " + gone.branches() + " branch(es), "
                        + gone.deals() + " deal(s), " + gone.documents() + " document(s) and "
                        + gone.usersDeleted() + " user account(s)");
        return ResponseEntity.noContent().build();
    }
}
