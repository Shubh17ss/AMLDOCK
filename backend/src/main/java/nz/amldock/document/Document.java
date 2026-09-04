package nz.amldock.document;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A live document row. Its columns live on {@link DocumentFields}, which the deal's per-version
 * copy also extends.
 */
@Entity
@Table(name = "document")
public class Document extends DocumentFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    public Long getId() { return id; }
    public Long getDocumentId() { return id; }
}
