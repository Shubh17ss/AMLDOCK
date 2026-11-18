package nz.amldock.firm;

import nz.amldock.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * A deactivated branch is read-only to everyone, ROOT included: its records are under a
 * retention hold (RetentionPolicy) and must stay as they were when it closed. Its own staff can't
 * sign in at all — their memberships went off with it — so this is what holds the line for the
 * firm-level roles and ROOT, who can still open it.
 *
 * <p>Read paths never call this. Every write to something a branch owns does, after its own
 * permission check, so that someone with no business there is told that rather than this.
 */
@Service
public class ScopeStatusGuard {

    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;

    public ScopeStatusGuard(FirmBranchRepository branches, RealEstateFirmRepository firms) {
        this.branches = branches;
        this.firms = firms;
    }

    /**
     * For a row that names its entity and maybe a branch. The entity check is what holds an
     * entity-wide row (no branch) of a deactivated entity, for ROOT, who reaches any entity; its
     * own staff are already stopped at the door by InactiveScopeReadOnlyFilter.
     */
    public void assertWritable(Long firmId, Long branchId) {
        assertFirmWritable(firmId);
        assertBranchWritable(branchId);
    }

    public void assertFirmWritable(Long firmId) {
        if (firmId == null) return;
        firms.findById(firmId).filter(f -> !f.isActive()).ifPresent(f -> {
            throw new ApiException(HttpStatus.CONFLICT,
                    f.getName() + " is deactivated — its records are read-only");
        });
    }

    /** No-op for a null branch: firm-level rows are the entity's concern, not a branch's. */
    public void assertBranchWritable(Long branchId) {
        if (branchId == null) return;
        branches.findById(branchId).filter(b -> !b.isActive()).ifPresent(b -> {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Branch " + b.getName() + " is deactivated — its records are read-only");
        });
    }
}
