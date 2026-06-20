package nz.amldock.firm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

@Entity
@Table(name = "real_estate_firm")
public class RealEstateFirm extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    /** NZBN (NZ) or ABN (AU) — a free-form business number. */
    private String nzbn;

    @Column(name = "liaison_name")
    private String liaisonName;

    @Column(name = "liaison_email")
    private String liaisonEmail;

    @Column(name = "liaison_contact_number")
    private String liaisonContactNumber;

    @Column(name = "senior_manager_name")
    private String seniorManagerName;

    @Column(name = "senior_manager_email")
    private String seniorManagerEmail;

    @Column(name = "senior_manager_contact_number")
    private String seniorManagerContactNumber;

    @Column(name = "number_of_branches")
    private Integer numberOfBranches;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getNzbn() { return nzbn; }
    public void setNzbn(String nzbn) { this.nzbn = nzbn; }
    public String getLiaisonName() { return liaisonName; }
    public void setLiaisonName(String liaisonName) { this.liaisonName = liaisonName; }
    public String getLiaisonEmail() { return liaisonEmail; }
    public void setLiaisonEmail(String liaisonEmail) { this.liaisonEmail = liaisonEmail; }
    public String getLiaisonContactNumber() { return liaisonContactNumber; }
    public void setLiaisonContactNumber(String liaisonContactNumber) { this.liaisonContactNumber = liaisonContactNumber; }
    public String getSeniorManagerName() { return seniorManagerName; }
    public void setSeniorManagerName(String seniorManagerName) { this.seniorManagerName = seniorManagerName; }
    public String getSeniorManagerEmail() { return seniorManagerEmail; }
    public void setSeniorManagerEmail(String seniorManagerEmail) { this.seniorManagerEmail = seniorManagerEmail; }
    public String getSeniorManagerContactNumber() { return seniorManagerContactNumber; }
    public void setSeniorManagerContactNumber(String seniorManagerContactNumber) { this.seniorManagerContactNumber = seniorManagerContactNumber; }
    public Integer getNumberOfBranches() { return numberOfBranches; }
    public void setNumberOfBranches(Integer numberOfBranches) { this.numberOfBranches = numberOfBranches; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
