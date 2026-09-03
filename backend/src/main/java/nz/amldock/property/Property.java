package nz.amldock.property;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The live property. Its columns live on {@link PropertyFields}, which the deal's per-version
 * copy also extends.
 */
@Entity
@Table(name = "property")
public class Property extends PropertyFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    public Long getId() { return id; }
    public Long getPropertyId() { return id; }
}
