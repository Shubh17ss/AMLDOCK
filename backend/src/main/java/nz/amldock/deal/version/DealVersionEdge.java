package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.ownership.OwnershipEdge;
import nz.amldock.ownership.OwnershipEdgeFields;
import org.springframework.beans.BeanUtils;

/**
 * One edge of the ownership structure as it stood at verification.
 *
 * <p>Its {@code parentNodeId} / {@code childNodeId} are the <em>live</em> node ids, matching
 * {@link DealVersionNode#getSourceNodeId()} within the same version.
 *
 * <p>Alone among the copies this does not extend {@code BaseEntity} — an edge has only its own
 * {@code createdAt}, which predates versioning — so there is no timestamp stamping to suppress.
 */
@Entity
@Table(name = "deal_version_edge")
public class DealVersionEdge extends OwnershipEdgeFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    @Column(name = "source_edge_id", nullable = false, updatable = false)
    private Long sourceEdgeId;

    public static DealVersionEdge copyOf(OwnershipEdge e, Long dealVersionId) {
        DealVersionEdge c = new DealVersionEdge();
        BeanUtils.copyProperties(e, c);
        c.dealVersionId = dealVersionId;
        c.sourceEdgeId = e.getId();
        return c;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public Long getEdgeId() { return sourceEdgeId; }
}
