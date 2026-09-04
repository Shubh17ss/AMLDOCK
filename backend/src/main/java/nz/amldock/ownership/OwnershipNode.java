package nz.amldock.ownership;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A live node in a deal's ownership structure. Its columns live on {@link OwnershipNodeFields},
 * which the deal's per-version copy also extends.
 */
@Entity
@Table(name = "ownership_node")
public class OwnershipNode extends OwnershipNodeFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    public Long getId() { return id; }
    public Long getNodeId() { return id; }
}
