package nz.amldock.audit;

import nz.amldock.audit.dto.AuditLogDto;
import nz.amldock.common.web.PageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import nz.amldock.deal.DealRef;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    /**
     * The platform's audit trail. ROOT only: the log records every user's actions across every
     * reporting entity, and reading it is a platform-operator task, not a firm one.
     */
    @GetMapping
    @PreAuthorize("hasRole('ROOT')")
    public PageResponse<AuditLogDto> search(
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) Long entityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return audit.search(actorUserId, action, entityType, entityId, from, to, page, size);
    }

    /** One deal's trail, by its public id. ROOT only, like the trail as a whole. */
    @GetMapping("/deal/{id}")
    @PreAuthorize("hasRole('ROOT')")
    public List<AuditLogDto> listForDeal(@DealRef("id") Long id) {
        return audit.listForDeal(id);
    }
}
