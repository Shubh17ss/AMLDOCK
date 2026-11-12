package nz.amldock.query;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

import java.time.Instant;

/**
 * A change a reporting entity's staff have asked the AMLDOCK admin team to make. See
 * V66__entity_query.sql for why the raiser's name and email are copied onto the row.
 */
@Entity
@Table(name = "entity_query")
public class EntityQuery extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "real_estate_firm_id", nullable = false)
    private Long realEstateFirmId;

    @Column(name = "raised_by_user_id")
    private Long raisedByUserId;

    @Column(name = "raised_by_name")
    private String raisedByName;

    @Column(name = "raised_by_email", nullable = false)
    private String raisedByEmail;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EntityQueryStatus status = EntityQueryStatus.OPEN;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by_user_id")
    private Long resolvedByUserId;

    public Long getId() { return id; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long realEstateFirmId) { this.realEstateFirmId = realEstateFirmId; }
    public Long getRaisedByUserId() { return raisedByUserId; }
    public void setRaisedByUserId(Long raisedByUserId) { this.raisedByUserId = raisedByUserId; }
    public String getRaisedByName() { return raisedByName; }
    public void setRaisedByName(String raisedByName) { this.raisedByName = raisedByName; }
    public String getRaisedByEmail() { return raisedByEmail; }
    public void setRaisedByEmail(String raisedByEmail) { this.raisedByEmail = raisedByEmail; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public EntityQueryStatus getStatus() { return status; }
    public void setStatus(EntityQueryStatus status) { this.status = status; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
    public Long getResolvedByUserId() { return resolvedByUserId; }
    public void setResolvedByUserId(Long resolvedByUserId) { this.resolvedByUserId = resolvedByUserId; }
}
