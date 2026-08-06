package nz.amldock.training;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

import java.time.LocalDate;

/**
 * One AML training session run for a branch. Staff are attached through
 * {@link TrainingSessionAttendee}; only branch-level staff of this session's branch may be
 * assigned (firm-level compliance staff run the training rather than attend it).
 */
@Entity
@Table(name = "training_session")
public class TrainingSession extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 512)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "location", nullable = false, length = 512)
    private String location;

    @Column(name = "url", length = 1024)
    private String url;

    @Column(name = "training_provider_id", nullable = false)
    private Long trainingProviderId;

    /** The day the session runs. Required — a session without a date can't be attended. */
    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "total_minutes", nullable = false)
    private Integer totalMinutes;

    @Column(name = "real_estate_firm_id")
    private Long realEstateFirmId;

    @Column(name = "firm_branch_id")
    private Long firmBranchId;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public String getLocation() { return location; }
    public void setLocation(String v) { this.location = v; }
    public String getUrl() { return url; }
    public void setUrl(String v) { this.url = v; }
    public Long getTrainingProviderId() { return trainingProviderId; }
    public void setTrainingProviderId(Long v) { this.trainingProviderId = v; }
    public LocalDate getSessionDate() { return sessionDate; }
    public void setSessionDate(LocalDate v) { this.sessionDate = v; }
    public Integer getTotalMinutes() { return totalMinutes; }
    public void setTotalMinutes(Integer v) { this.totalMinutes = v; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long v) { this.realEstateFirmId = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long v) { this.createdByUserId = v; }
}
