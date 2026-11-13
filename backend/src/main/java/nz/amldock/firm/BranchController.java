package nz.amldock.firm;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.firm.dto.BranchDto;
import nz.amldock.firm.dto.ConfirmDeleteRequest;
import nz.amldock.firm.dto.UpdateBranchRequest;
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

/** Branches are named in paths by their public id ({@link FirmPublicIds}). */
@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchService branches;
    private final BranchDeletionService deletion;
    private final AuditService audit;

    public BranchController(BranchService branches, BranchDeletionService deletion, AuditService audit) {
        this.branches = branches;
        this.deletion = deletion;
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

    /** Off-boarding is ROOT's alone; status no longer changes through PATCH. */
    @PostMapping("/{ref}/deactivate")
    @PreAuthorize("hasRole('ROOT')")
    public BranchDto deactivate(@PathVariable String ref) {
        FirmBranch b = branches.deactivate(branches.resolve(ref), DeactivationSource.MANUAL);
        audit.record(AuditAction.BRANCH_DEACTIVATED, "FirmBranch", b.getId(), "Deactivated branch " + b.getName());
        return BranchDto.from(b);
    }

    @PostMapping("/{ref}/activate")
    @PreAuthorize("hasRole('ROOT')")
    public BranchDto activate(@PathVariable String ref) {
        FirmBranch b = branches.activate(branches.resolve(ref));
        audit.record(AuditAction.BRANCH_ACTIVATED, "FirmBranch", b.getId(), "Reactivated branch " + b.getName());
        return BranchDto.from(b);
    }

    /** What deleting would remove, whether it may be deleted yet, and anything that stops it. */
    @GetMapping("/{ref}/deletion-preview")
    @PreAuthorize("hasRole('ROOT')")
    public BranchDeletionService.Preview deletionPreview(@PathVariable String ref) {
        return deletion.preview(branches.resolve(ref));
    }

    /** Irreversible. The body carries the branch name, typed out by the person confirming. */
    @DeleteMapping("/{ref}")
    @PreAuthorize("hasRole('ROOT')")
    public ResponseEntity<Void> delete(@PathVariable String ref, @RequestBody ConfirmDeleteRequest req) {
        Long id = branches.resolve(ref);
        BranchDeletionService.Preview gone = deletion.delete(id, req.confirmName());
        audit.record(AuditAction.BRANCH_DELETED, "FirmBranch", id,
                "Deleted branch " + gone.branchName() + " (" + ref + ") with " + gone.deals() + " deal(s), "
                        + gone.documents() + " document(s) and " + gone.usersDeleted() + " user account(s)");
        return ResponseEntity.noContent().build();
    }
}
