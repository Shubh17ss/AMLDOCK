package nz.amldock.ownership;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.ownership.dto.CreateEdgeRequest;
import nz.amldock.ownership.dto.CreateNodeRequest;
import nz.amldock.ownership.dto.EdgeDto;
import nz.amldock.ownership.dto.NodeDto;
import nz.amldock.ownership.dto.SetRootRequest;
import nz.amldock.ownership.dto.TreeDto;
import nz.amldock.ownership.dto.UpdateEdgeRequest;
import nz.amldock.ownership.dto.UpdateNodeRequest;
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

@RestController
@RequestMapping("/api/deals/{dealId}/ownership")
public class OwnershipController {

    private final OwnershipService ownership;
    private final AuditService audit;

    public OwnershipController(OwnershipService ownership, AuditService audit) {
        this.ownership = ownership;
        this.audit = audit;
    }

    @GetMapping
    public TreeDto getTree(@PathVariable Long dealId) {
        return ownership.getTree(dealId);
    }

    /* ---------- nodes ---------- */

    @PostMapping("/nodes")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public NodeDto createNode(@PathVariable Long dealId, @Valid @RequestBody CreateNodeRequest req) {
        NodeDto node = ownership.createNode(dealId, req);
        audit.record(AuditAction.NODE_CREATED, "OwnershipNode", node.id(),
                "Created " + node.nodeType() + " node \"" + node.displayName() + "\" on deal " + dealId);
        return node;
    }

    @PatchMapping("/nodes/{nodeId}")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public NodeDto updateNode(@PathVariable Long dealId, @PathVariable Long nodeId,
                              @RequestBody UpdateNodeRequest req) {
        NodeDto node = ownership.updateNode(dealId, nodeId, req);
        audit.record(AuditAction.NODE_UPDATED, "OwnershipNode", node.id(),
                "Updated node \"" + node.displayName() + "\"");
        return node;
    }

    @DeleteMapping("/nodes/{nodeId}")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public ResponseEntity<Void> deleteNode(@PathVariable Long dealId, @PathVariable Long nodeId,
                                           @RequestParam(defaultValue = "false") boolean force) {
        ownership.deleteNode(dealId, nodeId, force);
        audit.record(AuditAction.NODE_DELETED, "OwnershipNode", nodeId,
                "Deleted node " + nodeId + (force ? " (cascade)" : ""));
        return ResponseEntity.noContent().build();
    }

    /* ---------- edges ---------- */

    @PostMapping("/edges")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public EdgeDto createEdge(@PathVariable Long dealId, @Valid @RequestBody CreateEdgeRequest req) {
        EdgeDto edge = ownership.createEdge(dealId, req);
        audit.record(AuditAction.EDGE_CREATED, "OwnershipEdge", edge.id(),
                "Linked node " + edge.parentNodeId() + " → " + edge.childNodeId()
                        + (edge.percentage() != null ? " @ " + edge.percentage() + "%" : "")
                        + (edge.role() != null ? " role=" + edge.role() : ""));
        return edge;
    }

    @PatchMapping("/edges/{edgeId}")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public EdgeDto updateEdge(@PathVariable Long dealId, @PathVariable Long edgeId,
                              @Valid @RequestBody UpdateEdgeRequest req) {
        EdgeDto edge = ownership.updateEdge(dealId, edgeId, req);
        audit.record(AuditAction.EDGE_UPDATED, "OwnershipEdge", edge.id(),
                "Updated edge " + edge.id());
        return edge;
    }

    @DeleteMapping("/edges/{edgeId}")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public ResponseEntity<Void> deleteEdge(@PathVariable Long dealId, @PathVariable Long edgeId) {
        ownership.deleteEdge(dealId, edgeId);
        audit.record(AuditAction.EDGE_DELETED, "OwnershipEdge", edgeId, "Removed edge " + edgeId);
        return ResponseEntity.noContent().build();
    }

    /* ---------- root ---------- */

    @PostMapping("/root")
    @PreAuthorize("hasAnyRole('COMPLIANCE','MANAGER')")
    public TreeDto setRoot(@PathVariable Long dealId, @RequestBody SetRootRequest req) {
        return ownership.setRoot(dealId, req.nodeId());
    }
}
