package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyFields;
import org.springframework.beans.BeanUtils;

/**
 * The property as it stood at verification. Copied rather than referenced because the live row is
 * deleted with the deal ({@code DealService.delete}) and edited freely while the deal is open.
 */
@Entity
@Table(name = "deal_version_property")
public class DealVersionProperty extends PropertyFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    @Column(name = "source_property_id", nullable = false, updatable = false)
    private Long sourcePropertyId;

    @Override
    protected boolean stampsOwnTimestamps() { return false; }

    public static DealVersionProperty copyOf(Property p, Long dealVersionId) {
        DealVersionProperty c = new DealVersionProperty();
        BeanUtils.copyProperties(p, c);
        c.createdAt = p.getCreatedAt();
        c.updatedAt = p.getUpdatedAt();
        c.dealVersionId = dealVersionId;
        c.sourcePropertyId = p.getId();
        return c;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public Long getPropertyId() { return sourcePropertyId; }
}
