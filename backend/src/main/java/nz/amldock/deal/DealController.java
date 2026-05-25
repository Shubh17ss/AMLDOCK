package nz.amldock.deal;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.UpdateDealRequest;
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

    @PostMapping
    @PreAuthorize("hasRole('BROKER')")
    public DealDto create(@Valid @RequestBody CreateDealRequest req) {
        Deal d = deals.create(req);
        audit.record(AuditAction.DEAL_CREATED, "Deal", d.getId(),
                "Created draft deal " + d.getReference());
        return deals.toDtoAfterMutation(d);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('BROKER')")
    public DealDto update(@PathVariable Long id, @RequestBody UpdateDealRequest req) {
        Deal d = deals.update(id, req);
        return deals.toDtoAfterMutation(d);
    }

    @PatchMapping("/{id}/property")
    @PreAuthorize("hasRole('BROKER')")
    public DealDto updateProperty(@PathVariable Long id, @RequestBody PropertyInput input) {
        deals.updateProperty(id, input);
        return deals.get(id);
    }

    @PatchMapping("/{id}/client")
    @PreAuthorize("hasRole('BROKER')")
    public DealDto updateClient(@PathVariable Long id, @Valid @RequestBody ClientInput input) {
        deals.updateClient(id, input);
        return deals.get(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('BROKER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        deals.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('BROKER')")
    public DealDto submit(@PathVariable Long id) {
        Deal d = deals.submit(id);
        audit.record(AuditAction.DEAL_SUBMITTED, "Deal", d.getId(),
                "Deal " + d.getReference() + " submitted for review");
        return deals.toDtoAfterMutation(d);
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public DealDto assign(@PathVariable Long id) {
        Deal d = deals.assign(id);
        audit.record(AuditAction.DEAL_ASSIGNED, "Deal", d.getId(),
                "Deal " + d.getReference() + " claimed for review");
        return deals.toDtoAfterMutation(d);
    }
}
