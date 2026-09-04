package nz.amldock.client;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;
import nz.amldock.common.audit.BaseEntity;

/**
 * Every column a client carries, spelled once — see {@link nz.amldock.deal.DealFields} for why
 * the deal's snapshot tables are built this way rather than by transcribing each column twice.
 */
@MappedSuperclass
public abstract class ClientFields extends BaseEntity {

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "client_type", nullable = false, length = 32)
    private ClientType clientType;

    private String email;
    private String phone;

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public ClientType getClientType() { return clientType; }
    public void setClientType(ClientType v) { this.clientType = v; }
    public String getEmail() { return email; }
    public void setEmail(String v) { this.email = v; }
    public String getPhone() { return phone; }
    public void setPhone(String v) { this.phone = v; }

    /**
     * The id of the client these columns describe.
     *
     * <p>On the live entity that is the row's own id; on the deal's per-version copy it is
     * the id of the row that was frozen, not the copy's. DTOs built from either side have to
     * agree on what an id means — an edge naming a node, a link naming a deal — so this is the
     * one they read, and {@code getId()} stays each table's own primary key.
     */
    public abstract Long getClientId();
}
