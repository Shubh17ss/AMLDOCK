package nz.amldock.deal;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * The deal's state machine and the permission checks guarding it.
 *
 * <p>Every transition goes through {@link #transition}, so {@link #RULES} is the only place a
 * status changes — apart from {@link #override}, which sits outside the table on purpose. That
 * is the whole design: a new state or a new verb is a row, not another method carrying its own
 * half-remembered checks.
 *
 * <p><b>Firm scope.</b> Every entry point takes the deal's firm id and checks it. The version
 * this replaces checked the actor's <em>role</em> and nothing else on the decision paths, which
 * let a compliance officer of one reporting entity act on another's deals by id.
 */
@Service
public class DealLifecycleService {

    /** Who a rule admits. Both are additionally scoped to the deal's own firm. */
    private enum Who {
        /** The broker who created it (AGENT / AGENT_PA / ADMIN), or any AMLCO / SM of the firm. */
        EDITOR,
        /** AMLCO / SENIOR_MANAGER of the firm. */
        REVIEWER
    }

    private record Rule(Set<DealStatus> from, DealStatus to, Who who, boolean noteRequired) {}

    /**
     * The transition table.
     *
     * <pre>
     *                  ┌──────────reopen──────────┐
     *                  ▼                          │
     * NEW ──submit──▶ REVIEW ──verify──▶ VERIFIED ──close──▶ CLOSED
     *  ▲                │
     *  │                └──hold──▶ ON_HOLD
     *  └──────revert────┴──────────────┘
     * </pre>
     *
     * <p>There is no staging status between the broker and compliance: submitting hands the deal
     * straight to review, because a queue nobody works from is not a state.
     *
     * <p>ON_HOLD is the only negative outcome and its only exit is back to NEW — a parked deal
     * always returns through the broker, so there is a fresh submission on the record before
     * verification.
     *
     * <p>REOPEN is the one edge that was long absent, and it is here now only because verifying
     * writes a {@link nz.amldock.deal.version.DealVersion} first. The objection to it was never
     * that compliance should not be able to correct a verified deal — it was that correcting one
     * silently rewrites the evidence behind a sign-off. Snapshotting answers that: the sign-off
     * points at a copy, so the live deal is free to move. It lands in REVIEW rather than NEW
     * because the work is compliance's to finish, not the broker's to redo.
     */
    private static final Map<DealAction, Rule> RULES = Map.of(
        DealAction.SUBMIT, new Rule(EnumSet.of(DealStatus.NEW),      DealStatus.REVIEW,   Who.EDITOR,   false),
        DealAction.HOLD,   new Rule(EnumSet.of(DealStatus.REVIEW),   DealStatus.ON_HOLD,  Who.REVIEWER, true),
        DealAction.VERIFY, new Rule(EnumSet.of(DealStatus.REVIEW),   DealStatus.VERIFIED, Who.REVIEWER, true),
        DealAction.CLOSE,  new Rule(EnumSet.of(DealStatus.VERIFIED), DealStatus.CLOSED,   Who.REVIEWER, false),
        DealAction.REOPEN, new Rule(EnumSet.of(DealStatus.VERIFIED), DealStatus.REVIEW,   Who.REVIEWER, true),
        DealAction.REVERT, new Rule(EnumSet.of(DealStatus.REVIEW,
                                               DealStatus.ON_HOLD),  DealStatus.NEW,      Who.REVIEWER, true));

    /** The only status in which the broker who authored a deal may still change it. */
    public static final DealStatus EDITABLE_STATUS = DealStatus.NEW;

    /**
     * The statuses a firm-level reviewer may change a deal's content in.
     *
     * <p>Wider than the author's single status, because these are the states in which the
     * deal is <em>sitting with compliance</em>: under review, or parked. A
     * reviewer working through an ownership structure has to be able to correct and remove
     * what they find, and bouncing the deal back to the broker to fix a typo is not a
     * workflow, it is an obstacle.
     *
     * <p>VERIFIED and CLOSED are deliberately absent. Those carry a compliance sign-off, and
     * quietly editing the evidence underneath one would make the sign-off untrue. Reverting
     * or overriding first puts that decision on the record, which is the point.
     */
    public static final Set<DealStatus> REVIEWER_EDITABLE_STATUSES = EnumSet.of(
            DealStatus.NEW, DealStatus.REVIEW, DealStatus.ON_HOLD);

    /** Whether this actor may change the content of a deal in this status. */
    public static boolean canEditContent(DealStatus status, Role role) {
        return isDecider(role)
                ? REVIEWER_EDITABLE_STATUSES.contains(status)
                : status == EDITABLE_STATUS;
    }

    /* ---------- entry points ---------- */

    /**
     * Runs a lifecycle verb and returns the status the deal came from.
     *
     * <p>Permission is checked before state, so someone who may not act at all is told that,
     * rather than being told which states the deal is not in.
     */
    public DealStatus transition(Deal deal, UserPrincipal actor, DealAction action,
                                 Long dealFirmId, String note) {
        Rule rule = RULES.get(action);
        if (rule == null) {
            throw new BadRequestException("Unknown action " + action);
        }

        assertActor(deal, actor, dealFirmId, rule.who());

        DealStatus previous = deal.getStatus();
        if (!rule.from().contains(previous)) {
            throw new BadRequestException("A deal in " + previous + " cannot be " + past(action)
                    + " (allowed from: " + rule.from() + ")");
        }
        if (rule.noteRequired()) {
            requireNote(note, "A note is required to " + action.name().toLowerCase().replace('_', ' '));
        }

        deal.setStatus(rule.to());
        stampDecision(deal, actor, rule.to());
        return previous;
    }

    /**
     * May this actor change the deal's <em>content</em>?
     *
     * <p>Two groups, and they differ twice over. The broker who created it owns the answers
     * and may correct them, but only while the deal is still theirs — once submitted it is
     * someone else's to work on. An AMLCO or senior manager of the firm may correct them
     * throughout the states where the deal sits with compliance, because that is when they
     * are doing the work. Nobody else — including ROOT, which reads and deletes but does not
     * author a firm's compliance records.
     *
     * <p>The error names the statuses open to <em>this</em> actor. A reviewer told "only NEW
     * deals may be edited" would reasonably conclude the feature was broken.
     */
    public void assertEditable(Deal deal, UserPrincipal actor, Long dealFirmId) {
        assertActor(deal, actor, dealFirmId, Who.EDITOR);
        if (!canEditContent(deal.getStatus(), actor.role())) {
            String allowed = isDecider(actor.role())
                    ? REVIEWER_EDITABLE_STATUSES.toString()
                    : "[" + EDITABLE_STATUS + "]";
            throw new BadRequestException("A deal in " + deal.getStatus() + " cannot be edited"
                    + " — allowed from: " + allowed + ". Revert it first.");
        }
    }

    /**
     * SENIOR_MANAGER-only force transition, deliberately outside the table above.
     *
     * <p>With no rejected state and no path out of VERIFIED or CLOSED, this is the only way to
     * correct a deal that ended up somewhere wrong.
     */
    public DealStatus override(Deal deal, UserPrincipal actor, DealStatus target,
                               Long dealFirmId, String reason) {
        if (actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only senior managers may override a deal's status");
        }
        assertSameFirm(actor, dealFirmId);
        if (target == null) {
            throw new BadRequestException("Target status is required");
        }
        requireNote(reason, "An override reason is required");

        DealStatus previous = deal.getStatus();
        if (previous == target) {
            throw new BadRequestException("Deal is already in status " + target);
        }
        deal.setStatus(target);
        stampDecision(deal, actor, target);
        return previous;
    }

    /* ---------- read scope — unchanged ---------- */

    /** Deals are authored by the branch-level deal creators: AGENT, AGENT_PA, ADMIN. */
    static boolean isDealAuthor(Role role) {
        return role == Role.AGENT || role == Role.AGENT_PA || role == Role.ADMIN;
    }

    /**
     * Who may open a new deal.
     *
     * <p>Deliberately wider than {@link #isDealAuthor} and deliberately separate from it. Authorship
     * carries rights that outlive creation — editing a NEW deal, submitting it, deleting one's own —
     * and a sales manager or compliance officer starting a file on a broker's behalf is not meant to
     * acquire those. Widening {@code isDealAuthor} instead would have granted all of them silently.
     *
     * <p>The branch-level roles create on their own branch, which {@code DealService.create} derives
     * from them. The firm-level roles have no branch of their own, so they must name one and it must
     * belong to their firm. ROOT is absent because it has no firm either, and AUDIT because it writes
     * nothing anywhere.
     */
    static boolean canCreateDeal(Role role) {
        return isDealAuthor(role)
                || role == Role.SALES_MANAGER
                || role == Role.AML_COMPLIANCE_OFFICER
                || role == Role.SENIOR_MANAGER;
    }

    /** Firm-level reviewers. A deal is no longer tied to one of them — any will do. */
    static boolean isDecider(Role role) {
        return role == Role.AML_COMPLIANCE_OFFICER || role == Role.SENIOR_MANAGER;
    }

    /**
     * Read scope:
     *   AGENT / AGENT_PA           → own deals only
     *   ADMIN / SALES_MANAGER      → any deal in their branch
     *   AML_COMPLIANCE_OFFICER /
     *     SENIOR_MANAGER           → any deal in their firm
     *   ROOT / AUDIT               → all deals (AUDIT reads only — see AuditReadOnlyFilter)
     *   FINANCE                    → none; deals are outside its section
     */
    public void assertCanRead(Deal deal, UserPrincipal actor, Long branchFirmId) {
        switch (actor.role()) {
            case AGENT, AGENT_PA -> {
                if (!actor.id().equals(deal.getCreatedByUserId())) {
                    throw new ForbiddenException("Not your deal");
                }
            }
            case ADMIN, SALES_MANAGER -> {
                if (actor.firmBranchId() == null || !actor.firmBranchId().equals(deal.getFirmBranchId())) {
                    throw new ForbiddenException("Not your branch's deal");
                }
            }
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> {
                if (branchFirmId == null || !branchFirmId.equals(actor.realEstateFirmId())) {
                    throw new ForbiddenException("Not your firm's deal");
                }
            }
            case ROOT, AUDIT -> { /* all access */ }
            // Stated rather than left to fall through this switch, which would have granted
            // everything.
            case FINANCE -> throw new ForbiddenException("Deals are outside the finance role");
        }
    }

    /* ---------- internals ---------- */

    private void assertActor(Deal deal, UserPrincipal actor, Long dealFirmId, Who who) {
        if (isDecider(actor.role())) {
            assertSameFirm(actor, dealFirmId);
            return;
        }
        if (who == Who.EDITOR && isDealAuthor(actor.role())) {
            if (!actor.id().equals(deal.getCreatedByUserId())) {
                throw new ForbiddenException("Not your deal");
            }
            return;
        }
        throw new ForbiddenException(who == Who.EDITOR
                ? "Only the broker who created this deal, or a compliance officer or senior manager "
                  + "of the firm, may change it"
                : "Only a compliance officer or senior manager of the firm may do this");
    }

    private void assertSameFirm(UserPrincipal actor, Long dealFirmId) {
        if (dealFirmId == null || !dealFirmId.equals(actor.realEstateFirmId())) {
            throw new ForbiddenException("Not your firm's deal");
        }
    }

    /**
     * decided_by / decided_at record the compliance sign-off, so only VERIFIED sets them.
     * CLOSED follows verification and keeps the stamp; anything else has left the verified line,
     * where a stamp would claim a sign-off that no longer stands.
     */
    private void stampDecision(Deal deal, UserPrincipal actor, DealStatus target) {
        if (target == DealStatus.VERIFIED) {
            deal.setDecidedByUserId(actor.id());
            deal.setDecidedAt(Instant.now());
        } else if (target != DealStatus.CLOSED) {
            deal.setDecidedByUserId(null);
            deal.setDecidedAt(null);
        }
    }

    private void requireNote(String note, String message) {
        if (note == null || note.trim().length() < 3) {
            throw new BadRequestException(message + " (min 3 characters)");
        }
    }

    private static String past(DealAction a) {
        return switch (a) {
            case SUBMIT -> "submitted for review";
            case HOLD   -> "put on hold";
            case VERIFY -> "verified";
            case CLOSE  -> "closed";
            case REVERT -> "reverted";
            case REOPEN -> "reopened";
        };
    }
}
