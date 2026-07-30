package nz.amldock.compliancedoc;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

import java.time.Instant;
import java.time.LocalDate;

/**
 * The review schedule for one compliance module in a given scope (firm + optional branch).
 * Holds the next review due date and the last "mark complete" stamp. There is at most one
 * row per scope + module.
 *
 * {@code moduleKey} is a module id from the frontend module registry — see
 * {@link ReviewableModules} for the permitted values.
 */
@Entity
@Table(name = "document_review")
public class DocumentReview extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "module_key", nullable = false, length = 64)
    private String moduleKey;

    @Column(name = "real_estate_firm_id")
    private Long realEstateFirmId;

    @Column(name = "firm_branch_id")
    private Long firmBranchId;

    @Column(name = "next_review_date")
    private LocalDate nextReviewDate;

    @Column(name = "last_completed_at")
    private Instant lastCompletedAt;

    @Column(name = "last_completed_by_user_id")
    private Long lastCompletedByUserId;

    public Long getId() { return id; }
    public String getModuleKey() { return moduleKey; }
    public void setModuleKey(String v) { this.moduleKey = v; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long v) { this.realEstateFirmId = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public LocalDate getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(LocalDate v) { this.nextReviewDate = v; }
    public Instant getLastCompletedAt() { return lastCompletedAt; }
    public void setLastCompletedAt(Instant v) { this.lastCompletedAt = v; }
    public Long getLastCompletedByUserId() { return lastCompletedByUserId; }
    public void setLastCompletedByUserId(Long v) { this.lastCompletedByUserId = v; }
}
