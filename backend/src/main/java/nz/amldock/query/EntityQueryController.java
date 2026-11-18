package nz.amldock.query;

import jakarta.validation.Valid;
import nz.amldock.query.dto.EntityQueryDto;
import nz.amldock.query.dto.RaiseEntityQueryRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Workspace › Queries. An entity's compliance officer or senior manager raises one from
 * Settings › Reporting Entity; ROOT works through them. AUDIT is refused writes by
 * AuditReadOnlyFilter and has no read here either — the queue is the admin team's.
 */
@RestController
@RequestMapping("/api/entity-queries")
public class EntityQueryController {

    private final EntityQueryService queries;

    public EntityQueryController(EntityQueryService queries) {
        this.queries = queries;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
    public EntityQueryDto raise(@Valid @RequestBody RaiseEntityQueryRequest req) {
        return queries.raise(req.message());
    }

    @GetMapping
    @PreAuthorize("hasRole('ROOT')")
    public List<EntityQueryDto> list() {
        return queries.list();
    }

    @PostMapping("/{id}/resolve")
    @PreAuthorize("hasRole('ROOT')")
    public ResponseEntity<Void> resolve(@PathVariable Long id) {
        queries.resolve(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROOT')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        queries.delete(id);
        return ResponseEntity.noContent().build();
    }
}
