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
 * A self-paced course: material to work through plus a questionnaire that proves it was.
 * Branch-scoped like every other training record, and assignable only to branch-level staff.
 */
@Entity
@Table(name = "training_course")
public class TrainingCourse extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 512)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /** The score a taker must reach to pass, as a whole percentage between 1 and 100. */
    @Column(name = "pass_mark_percent", nullable = false)
    private Integer passMarkPercent;

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
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate v) { this.dueDate = v; }
    public Integer getPassMarkPercent() { return passMarkPercent; }
    public void setPassMarkPercent(Integer v) { this.passMarkPercent = v; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long v) { this.realEstateFirmId = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long v) { this.createdByUserId = v; }
}
