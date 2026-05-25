package nz.amldock.deal;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.springframework.stereotype.Service;

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
