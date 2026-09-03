package nz.amldock.client;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The live client. Its columns live on {@link ClientFields}, which the deal's per-version copy
 * also extends.
 */
@Entity
@Table(name = "client")
public class Client extends ClientFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    public Long getId() { return id; }
    public Long getClientId() { return id; }
}
