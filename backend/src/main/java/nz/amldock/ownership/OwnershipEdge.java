package nz.amldock.ownership;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A live edge in a deal's ownership structure. Its columns live on {@link OwnershipEdgeFields},
 * which the deal's per-version copy also extends.
 */
@Entity
@Table(name = "ownership_edge")
public class OwnershipEdge extends OwnershipEdgeFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    public Long getId() { return id; }
    public Long getEdgeId() { return id; }
}
