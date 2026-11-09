package nz.amldock.ownership;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

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

    /**
     * Shared by every node that stands for the same person or entity across deals. A fresh node
     * gets its own; a copy made from the owner picker inherits its source's. Here rather than on
     * {@link OwnershipNodeFields}, which also maps the per-version copy table.
     */
    @Column(name = "identity_key", nullable = false, updatable = false)
    private UUID identityKey = UUID.randomUUID();

    public Long getId() { return id; }
    public Long getNodeId() { return id; }
    public UUID getIdentityKey() { return identityKey; }
    public void setIdentityKey(UUID identityKey) { this.identityKey = identityKey; }
}
