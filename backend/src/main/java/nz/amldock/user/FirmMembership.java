package nz.amldock.user;

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
 * One account's place in one reporting entity: the role it holds there, its branch (branch-level
 * roles only) and whether it is switched on. See V68__firm_membership.sql.
 *
 * <p>ROOT and AUDIT have none — they belong to no entity. Everyone else has one per entity they
 * have ever been added to; which of those may be active together is {@link MembershipService}'s rule.
 */
@Entity
@Table(name = "firm_membership")
public class FirmMembership extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "app_user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "real_estate_firm_id", nullable = false, updatable = false)
    private Long realEstateFirmId;

    @Column(name = "firm_branch_id")
    private Long firmBranchId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Role role;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long realEstateFirmId) { this.realEstateFirmId = realEstateFirmId; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long firmBranchId) { this.firmBranchId = firmBranchId; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public boolean isActive() { return active; }
    public Instant getDeactivatedAt() { return deactivatedAt; }

    public void setActive(boolean active) {
        if (this.active == active) return;
        this.active = active;
        this.deactivatedAt = active ? null : Instant.now();
    }
}
