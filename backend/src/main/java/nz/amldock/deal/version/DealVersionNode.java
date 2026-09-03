package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeFields;
import org.springframework.beans.BeanUtils;

/**
 * One node of the ownership structure as it stood at verification.
 *
 * <p>The widest of the copies, and the one that matters most: a node carries the nominee, complex
 * ownership and trust-portfolio answers that {@code DealRiskService} reads, so a version without
 * these could not reproduce the risk rating it was signed off with.
 */
@Entity
@Table(name = "deal_version_node")
public class DealVersionNode extends OwnershipNodeFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    /**
     * The live node this froze.
     *
     * <p>Edges and documents in this version name node ids from the live table rather than the
     * copies' own, which is what makes the copy possible in one pass with no id remapping.
     * {@code BIGSERIAL} never reuses a value, so the reference stays unambiguous even after the
     * live node is deleted.
     */
    @Column(name = "source_node_id", nullable = false, updatable = false)
    private Long sourceNodeId;

    @Override
    protected boolean stampsOwnTimestamps() { return false; }

    public static DealVersionNode copyOf(OwnershipNode n, Long dealVersionId) {
        DealVersionNode c = new DealVersionNode();
        BeanUtils.copyProperties(n, c);
        c.createdAt = n.getCreatedAt();
        c.updatedAt = n.getUpdatedAt();
        c.dealVersionId = dealVersionId;
        c.sourceNodeId = n.getId();
        return c;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public Long getNodeId() { return sourceNodeId; }
}
