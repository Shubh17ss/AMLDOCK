package nz.amldock.deal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The live deal.
 *
 * <p>Its columns live on {@link DealFields}, which {@link nz.amldock.deal.version.DealVersion}
 * also extends — see that class for why the two must not be able to drift apart. This one holds
 * only what is its own: the identity every other row in the system points at.
 */
@Entity
@Table(name = "deal")
public class Deal extends DealFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * How the deal is named outside the database — URLs, the API, email links. Random, so it says
     * nothing about how many deals exist. See {@link PublicIds}.
     */
    @Column(name = "public_id", nullable = false, updatable = false, length = 12)
    private String publicId;

    public Long getId() { return id; }
    public Long getDealId() { return id; }
    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
}
