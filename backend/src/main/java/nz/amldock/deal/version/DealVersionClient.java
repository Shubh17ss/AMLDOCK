package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.client.Client;
import nz.amldock.client.ClientFields;
import org.springframework.beans.BeanUtils;

/**
 * The client as it stood at verification. Copied for the same reason as the property: the live
 * row is deleted with the deal and editable until then.
 */
@Entity
@Table(name = "deal_version_client")
public class DealVersionClient extends ClientFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_version_id", nullable = false, updatable = false)
    private Long dealVersionId;

    @Column(name = "source_client_id", nullable = false, updatable = false)
    private Long sourceClientId;

    @Override
    protected boolean stampsOwnTimestamps() { return false; }

    public static DealVersionClient copyOf(Client c0, Long dealVersionId) {
        DealVersionClient c = new DealVersionClient();
        BeanUtils.copyProperties(c0, c);
        c.createdAt = c0.getCreatedAt();
        c.updatedAt = c0.getUpdatedAt();
        c.dealVersionId = dealVersionId;
        c.sourceClientId = c0.getId();
        return c;
    }

    public Long getId() { return id; }
    public Long getDealVersionId() { return dealVersionId; }
    public Long getClientId() { return sourceClientId; }
}
