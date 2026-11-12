package nz.amldock.firm;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.firm.dto.BranchDto;
import nz.amldock.firm.dto.UpdateBranchRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Branches are named in paths by their public id ({@link FirmPublicIds}). */
@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchService branches;
    private final AuditService audit;

    public BranchController(BranchService branches, AuditService audit) {
        this.branches = branches;
        this.audit = audit;
    }

    @GetMapping("/{ref}")
    public BranchDto get(@PathVariable String ref) {
        return BranchDto.from(branches.findById(branches.resolve(ref)));
    }

    @PatchMapping("/{ref}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
    public BranchDto update(@PathVariable String ref, @RequestBody UpdateBranchRequest req) {
        FirmBranch b = branches.update(branches.resolve(ref), req);
        audit.record(AuditAction.BRANCH_UPDATED, "FirmBranch", b.getId(), "Updated branch " + b.getName());
        return BranchDto.from(b);
    }

    @DeleteMapping("/{ref}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> deactivate(@PathVariable String ref) {
        Long id = branches.resolve(ref);
        branches.deactivate(id);
        audit.record(AuditAction.BRANCH_DELETED, "FirmBranch", id, "Deactivated branch " + ref);
        return ResponseEntity.noContent().build();
    }
}
