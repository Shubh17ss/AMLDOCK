package nz.amldock.beneficialowner;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A natural person identified from a scanned ID.
 *
 * <p>This is <em>who someone is</em>, scoped to a reporting entity and reusable across that
 * firm's deals. Where they sit in a particular deal's ownership graph is a separate concern,
 * held by {@link nz.amldock.ownership.OwnershipNode}.
 *
 * <p>Name, date of birth and expiry are all nullable: extraction returns what it could read,
 * and a field it could not read stays null rather than being filled with a guess.
 *
 * <p>Its columns live on {@link BeneficialOwnerFields}, which the deal's per-version copy also
 * extends — because this row is shared across a firm's deals, a verified deal has to keep its
 * own copy of who it checked.
 */
@Entity
@Table(name = "beneficial_owner")
public class BeneficialOwner extends BeneficialOwnerFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    public Long getId() { return id; }
    public Long getBeneficialOwnerId() { return id; }
}
