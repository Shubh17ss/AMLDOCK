package nz.amldock.ownership;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.document.Document;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Withdraws an owner's verification once what it was granted on has changed.
 *
 * <p>A verification is a decision about an owner's details and evidence as they stood. Changing a
 * detail, or adding or removing a document, after the fact leaves a "Verified" that no reviewer
 * ever gave, so the owner goes back to not verified and has to be cleared again. The byline and
 * any exception note go with it: they described the decision being withdrawn.
 *
 * <p>Not reset by: the owner's Type (their roles) and ownership percentages — those say where the
 * owner sits in the structure, not who they are.
 *
 * <p>Its own small component, on repositories only, so both {@link OwnershipService} and
 * {@code DocumentService} can call it without a constructor cycle.
 */
@Component
public class VerificationReset {

    private final OwnershipNodeRepository nodes;
    private final AuditService audit;

    public VerificationReset(OwnershipNodeRepository nodes, AuditService audit) {
        this.nodes = nodes;
        this.audit = audit;
    }

    /** Clears the node's verification if it has one. Returns whether anything changed. */
    public boolean clearIfVerified(OwnershipNode n, String reason) {
        if (n == null || n.getVerificationStatus() == null || !n.getVerificationStatus().isVerified()) {
            return false;
        }
        n.setVerificationStatus(NodeVerificationStatus.NOT_STARTED);
        n.setVerificationNotes(null);
        n.setVerifiedByUserId(null);
        n.setVerifiedAt(null);
        nodes.save(n);
        audit.record(AuditAction.NODE_VERIFICATION_CLEARED, "OwnershipNode", n.getId(),
                "Verification on \"" + n.getDisplayName() + "\" cleared: " + reason);
        return true;
    }

    /**
     * Clears the owner a document is evidence about: the node it was filed on, or — for an ID scan,
     * which hangs off the person rather than a node — every node standing for that person.
     */
    public void clearForDocument(Document d, String reason) {
        if (d.getOwnershipNodeId() != null) {
            nodes.findById(d.getOwnershipNodeId()).ifPresent(n -> clearIfVerified(n, reason));
            return;
        }
        if (d.getBeneficialOwnerId() != null) {
            List<OwnershipNode> owners = nodes.findAllByBeneficialOwnerId(d.getBeneficialOwnerId());
            owners.forEach(n -> clearIfVerified(n, reason));
        }
    }
}
