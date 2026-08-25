package nz.amldock.deal;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.NoteRequest;
import nz.amldock.deal.dto.OverrideRequest;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.dealnote.dto.DealNoteDto;
import nz.amldock.property.dto.PropertyInput;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/deals")
public class DealController {

    /**
     * Who may reach an editing or submission endpoint at all.
     *
     * <p>Wider than the roles that may actually succeed — {@code DealLifecycleService} decides
     * that, scoped to the deal's own firm and its current status. These annotations only keep
     * roles with no business here from getting as far as asking.
     *
     * <p>Compliance officers and senior managers are included because they may correct a NEW
     * deal on the broker's behalf rather than bounce it back over a typo.
     */
    private static final String EDITOR_ROLES =
            "hasAnyRole('AGENT','AGENT_PA','ADMIN','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')";

    /** Firm-level reviewers. A deal is not assigned to one of them — any will do. */
    private static final String REVIEWER_ROLES =
            "hasAnyRole('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')";

    private final DealService deals;
    private final AuditService audit;

    public DealController(DealService deals, AuditService audit) {
        this.deals = deals;
        this.audit = audit;
    }

    @GetMapping
    public List<DealListItemDto> list(@RequestParam(required = false) DealStatus status,
                                      @RequestParam(required = false) Long firmId,
                                      @RequestParam(required = false) Long branchId) {
        return deals.list(status, firmId, branchId);
    }

    @GetMapping("/{id}")
    public DealDto get(@PathVariable Long id) {
        return deals.get(id);
    }

    /**
     * Wider than the roles that author a deal — see {@code DealLifecycleService.canCreateDeal}.
     * Creating one is not the same grant as editing, submitting or deleting it.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('AGENT','AGENT_PA','ADMIN','SALES_MANAGER',"
            + "'AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
    public DealDto create(@Valid @RequestBody CreateDealRequest req) {
        Deal d = deals.create(req);
        audit.record(AuditAction.DEAL_CREATED, "Deal", d.getId(),
                "Created deal " + d.getReference());
        return deals.toDtoAfterMutation(d);
    }

    @PatchMapping("/{id}")
    @PreAuthorize(EDITOR_ROLES)
    public DealDto update(@PathVariable Long id, @Valid @RequestBody UpdateDealRequest req) {
        Deal d = deals.update(id, req);
        return deals.toDtoAfterMutation(d);
    }

    @PatchMapping("/{id}/property")
    @PreAuthorize(EDITOR_ROLES)
    public DealDto updateProperty(@PathVariable Long id, @RequestBody PropertyInput input) {
        deals.updateProperty(id, input);
        return deals.get(id);
    }

    @PatchMapping("/{id}/client")
    @PreAuthorize(EDITOR_ROLES)
    public DealDto updateClient(@PathVariable Long id, @Valid @RequestBody ClientInput input) {
        deals.updateClient(id, input);
        return deals.get(id);
    }

    /**
     * ROOT and SENIOR_MANAGER may delete any deal in scope; the deal's author may delete only
     * their own, and only while it is NEW. {@code DealService.assertCanDelete} draws that second
     * line — this annotation only decides who gets as far as asking.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AGENT','AGENT_PA','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        deals.delete(id);
        return ResponseEntity.noContent().build();
    }

    /* ---------- lifecycle ---------- */
    // One endpoint per verb rather than a generic /transition taking a target status. @PreAuthorize
    // is per-method, so a generic endpoint would need the union of every role and then re-check
    // inside — which is exactly how the annotation and the service drift apart. A generic endpoint
    // accepting an arbitrary target is also what /override already is, and that is deliberately
    // senior-manager-only.

    @PostMapping("/{id}/submit")
    @PreAuthorize(EDITOR_ROLES)
    public DealDto submit(@PathVariable Long id) {
        var r = deals.act(id, DealAction.SUBMIT, null);
        audit.record(AuditAction.DEAL_SUBMITTED_FOR_REVIEW, "Deal", r.deal().getId(),
                "Deal " + r.deal().getReference() + " submitted to compliance for review");
        return deals.toDtoAfterMutation(r.deal());
    }

    @PostMapping("/{id}/hold")
    @PreAuthorize(REVIEWER_ROLES)
    public DealDto hold(@PathVariable Long id, @Valid @RequestBody NoteRequest req) {
        var r = deals.act(id, DealAction.HOLD, req.note());
        audit.record(AuditAction.DEAL_PUT_ON_HOLD, "Deal", r.deal().getId(),
                "Deal " + r.deal().getReference() + " put on hold from " + r.previousStatus());
        return deals.toDtoAfterMutation(r.deal());
    }

    @PostMapping("/{id}/verify")
    @PreAuthorize(REVIEWER_ROLES)
    public DealDto verify(@PathVariable Long id, @Valid @RequestBody NoteRequest req) {
        var r = deals.act(id, DealAction.VERIFY, req.note());
        audit.record(AuditAction.DEAL_VERIFIED, "Deal", r.deal().getId(),
                "Deal " + r.deal().getReference() + " verified");
        return deals.toDtoAfterMutation(r.deal());
    }

    @PostMapping("/{id}/close")
    @PreAuthorize(REVIEWER_ROLES)
    public DealDto close(@PathVariable Long id) {
        var r = deals.act(id, DealAction.CLOSE, null);
        audit.record(AuditAction.DEAL_CLOSED, "Deal", r.deal().getId(),
                "Deal " + r.deal().getReference() + " closed");
        return deals.toDtoAfterMutation(r.deal());
    }

    /**
     * Sends a deal back to the broker for changes.
     *
     * <p>A compliance decision, and only theirs: a submitted deal is already being worked on, so
     * there is no window in which the broker could pull it back unnoticed. The annotation is the
     * wider editor set only so the rejection comes from the lifecycle service, which can say why.
     */
    @PostMapping("/{id}/revert")
    @PreAuthorize(EDITOR_ROLES)
    public DealDto revert(@PathVariable Long id, @Valid @RequestBody NoteRequest req) {
        var r = deals.act(id, DealAction.REVERT, req.note());
        audit.record(AuditAction.DEAL_REVERTED, "Deal", r.deal().getId(),
                "Deal " + r.deal().getReference() + " reverted to NEW from " + r.previousStatus());
        return deals.toDtoAfterMutation(r.deal());
    }

    @PostMapping("/{id}/override")
    @PreAuthorize("hasRole('SENIOR_MANAGER')")
    public DealDto override(@PathVariable Long id, @Valid @RequestBody OverrideRequest req) {
        DealService.OverrideResult result = deals.override(id, req.targetStatus(), req.reason());
        audit.record(AuditAction.DEAL_OVERRIDDEN, "Deal", result.deal().getId(),
                "Deal " + result.deal().getReference()
                        + " overridden: " + result.previousStatus() + " → " + req.targetStatus());
        return deals.toDtoAfterMutation(result.deal());
    }

    /* ---------- notes timeline ---------- */
    // No @PreAuthorize: a note is exactly as readable and writable as the deal it belongs to, and
    // DealService runs assertCanRead on both paths. Annotating by role here would be a second,
    // coarser rule that could only disagree with the first.

    @GetMapping("/{id}/notes")
    public List<DealNoteDto> notes(@PathVariable Long id) {
        return deals.notes(id);
    }

    @PostMapping("/{id}/notes")
    public List<DealNoteDto> addNote(@PathVariable Long id, @Valid @RequestBody NoteRequest req) {
        Deal d = deals.comment(id, req.note());
        audit.record(AuditAction.DEAL_NOTE_ADDED, "Deal", d.getId(),
                "Note added to deal " + d.getReference());
        return deals.notes(id);
    }
}
