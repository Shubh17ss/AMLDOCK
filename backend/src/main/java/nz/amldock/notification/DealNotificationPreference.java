package nz.amldock.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

/**
 * One user's explicit answer for one event on one branch.
 *
 * <p>A row is a *deviation* from {@link NotificationDefaults}; absence means the default. So the
 * table stays small and, more importantly, a user or branch created after this feature shipped
 * needs no seeding to behave correctly.
 *
 * <p>{@code firmBranchId} is the branch of the *deal*, never the subscriber's own. For branch-level
 * staff the two coincide. For a compliance officer, whose own {@code firmBranchId} is NULL by DB
 * constraint, this is the column that lets them choose branch by branch.
 *
 * <p>Plain {@code Long} FK columns rather than JPA relations, matching {@link nz.amldock.user.User}
 * and {@link nz.amldock.deal.Deal}.
 */
@Entity
@Table(name = "deal_notification_preference")
public class DealNotificationPreference extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "app_user_id", nullable = false)
    private Long appUserId;

    @Column(name = "firm_branch_id", nullable = false)
    private Long firmBranchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 48)
    private DealNotificationEvent eventType;

    @Column(nullable = false)
    private boolean enabled;

    /** The user themselves, or an officer overriding from Settings. */
    @Column(name = "updated_by_user_id")
    private Long updatedByUserId;

    public Long getId() { return id; }
    public Long getAppUserId() { return appUserId; }
    public void setAppUserId(Long appUserId) { this.appUserId = appUserId; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long firmBranchId) { this.firmBranchId = firmBranchId; }
    public DealNotificationEvent getEventType() { return eventType; }
    public void setEventType(DealNotificationEvent eventType) { this.eventType = eventType; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Long getUpdatedByUserId() { return updatedByUserId; }
    public void setUpdatedByUserId(Long updatedByUserId) { this.updatedByUserId = updatedByUserId; }
}
