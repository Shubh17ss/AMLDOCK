package nz.amldock.deal;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Set;

/**
 * Encapsulates allowed status transitions and permission checks. Reused across milestones —
 * M3 only exercises submit; assign/approve/reject/override come in M7/M10.
 */
@Service
public class DealLifecycleService {

    public void assertOwnerEditable(Deal deal, UserPrincipal actor) {
        assertBrokerOwner(deal, actor);
        if (deal.getStatus() != DealStatus.DRAFT) {
            throw new BadRequestException("Only DRAFT deals may be edited by the broker");
        }
    }

    public void assertBrokerOwner(Deal deal, UserPrincipal actor) {
        if (actor.role() != Role.BROKER) {
            throw new ForbiddenException("Only brokers may modify their own draft deals");
        }
        if (!actor.id().equals(deal.getCreatedByUserId())) {
            throw new ForbiddenException("Not your deal");
        }
    }

    public void assertCanRead(Deal deal, UserPrincipal actor, Long branchFirmId) {
        switch (actor.role()) {
            case BROKER -> {
                if (!actor.id().equals(deal.getCreatedByUserId())) {
                    throw new ForbiddenException("Not your deal");
                }
            }
            case FIRM_USER -> {
                if (branchFirmId == null || !branchFirmId.equals(actor.realEstateFirmId())) {
                    throw new ForbiddenException("Not your firm's deal");
                }
            }
            case COMPLIANCE, MANAGER -> { /* all access */ }
        }
    }

    public void submit(Deal deal, UserPrincipal actor) {
        assertOwnerEditable(deal, actor);
        ensureSubmittable(deal);
        deal.setStatus(DealStatus.SUBMITTED);
    }

    /** SUBMITTED → UNDER_REVIEW (or no-op if already assigned to this caller). */
    public void assign(Deal deal, UserPrincipal actor) {
        if (actor.role() != Role.COMPLIANCE && actor.role() != Role.MANAGER) {
            throw new ForbiddenException("Only compliance officers or managers may claim a deal");
        }
        if (deal.getStatus() == DealStatus.DRAFT) {
            throw new BadRequestException("Deal must be submitted before it can be claimed");
        }
        if (deal.getStatus() == DealStatus.APPROVED || deal.getStatus() == DealStatus.REJECTED) {
            throw new BadRequestException("Decided deals can't be re-claimed");
        }
        // Idempotent: if already UNDER_REVIEW and assigned to caller, do nothing.
        if (deal.getStatus() == DealStatus.UNDER_REVIEW && actor.id().equals(deal.getAssignedComplianceUserId())) {
            return;
        }
        deal.setAssignedComplianceUserId(actor.id());
        deal.setStatus(DealStatus.UNDER_REVIEW);
    }

    /** UNDER_REVIEW → APPROVED. Compliance / Manager. Notes required. */
    public void approve(Deal deal, UserPrincipal actor, String notes) {
        assertDecider(actor);
        if (deal.getStatus() != DealStatus.UNDER_REVIEW) {
            throw new BadRequestException("Only UNDER_REVIEW deals can be approved");
        }
        requireNotes(notes, "Decision notes are required to approve");
        applyDecision(deal, actor, DealStatus.APPROVED, notes);
    }

    /** UNDER_REVIEW → REJECTED. Compliance / Manager. Notes required. */
    public void reject(Deal deal, UserPrincipal actor, String notes) {
        assertDecider(actor);
        if (deal.getStatus() != DealStatus.UNDER_REVIEW) {
            throw new BadRequestException("Only UNDER_REVIEW deals can be rejected");
        }
        requireNotes(notes, "Decision notes are required to reject");
        applyDecision(deal, actor, DealStatus.REJECTED, notes);
    }

    /**
     * MANAGER-only force transition to an arbitrary target. Reason required and prefixed
     * into the decision notes so the override is visible in any subsequent UI.
     * Returns the previous status so the caller can include it in the audit record.
     */
    public DealStatus override(Deal deal, UserPrincipal actor, DealStatus target, String reason) {
        if (actor.role() != Role.MANAGER) {
            throw new ForbiddenException("Only managers may override a deal's status");
        }
        if (target == null) {
            throw new BadRequestException("Target status is required");
        }
        requireNotes(reason, "An override reason is required");
        DealStatus previous = deal.getStatus();
        if (previous == target) {
            throw new BadRequestException("Deal is already in status " + target);
        }
        deal.setStatus(target);
        // Capture override reason in decision_notes for audit/visibility.
        String prefixed = String.format("[OVERRIDE %s → %s] %s", previous, target, reason);
        deal.setDecisionNotes(prefixed);
        // Only stamp decided_by/at when transitioning to a terminal state, so non-terminal
        // overrides (e.g. APPROVED → UNDER_REVIEW for re-review) don't fake a fresh decision.
        if (target == DealStatus.APPROVED || target == DealStatus.REJECTED) {
            deal.setDecidedByUserId(actor.id());
            deal.setDecidedAt(Instant.now());
        } else {
            deal.setDecidedByUserId(null);
            deal.setDecidedAt(null);
        }
        // Clear assignment if going back to a pre-claim state.
        if (target == DealStatus.DRAFT || target == DealStatus.SUBMITTED) {
            deal.setAssignedComplianceUserId(null);
        }
        return previous;
    }

    private void assertDecider(UserPrincipal actor) {
        if (actor.role() != Role.COMPLIANCE && actor.role() != Role.MANAGER) {
            throw new ForbiddenException("Only compliance officers or managers may decide a deal");
        }
    }

    private void requireNotes(String notes, String message) {
        if (notes == null || notes.trim().length() < 3) {
            throw new BadRequestException(message + " (min 3 characters)");
        }
    }

    private void applyDecision(Deal deal, UserPrincipal actor, DealStatus target, String notes) {
        deal.setStatus(target);
        deal.setDecisionNotes(notes.trim());
        deal.setDecidedByUserId(actor.id());
        deal.setDecidedAt(Instant.now());
    }

    private void ensureSubmittable(Deal deal) {
        if (deal.getClientId() == null || deal.getPropertyId() == null || deal.getFirmBranchId() == null) {
            throw new BadRequestException("Deal is missing required references (property/client/branch)");
        }
        if (deal.getTransactionType() == null) {
            throw new BadRequestException("Transaction type is required before submission");
        }
    }

    public static final Set<DealStatus> EDITABLE_BY_BROKER = Set.of(DealStatus.DRAFT);
}
