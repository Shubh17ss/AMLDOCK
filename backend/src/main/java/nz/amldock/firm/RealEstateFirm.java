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

    /** ISO 3166-1 alpha-2, restricted to the two jurisdictions the platform operates in. */
    @Column(name = "country", nullable = false, length = 2)
    private String country;

    @Column(name = "liaison_name")
    private String liaisonName;

    @Column(name = "liaison_email")
    private String liaisonEmail;

    @Column(name = "liaison_contact_number")
    private String liaisonContactNumber;

    /** The firm's AML compliance officer — its primary contact and the login onboarding creates. */
    @Column(name = "compliance_officer_name")
    private String complianceOfficerName;

    @Column(name = "compliance_officer_email")
    private String complianceOfficerEmail;

    @Column(name = "compliance_officer_contact_number")
    private String complianceOfficerContactNumber;

    @Column(name = "number_of_branches")
    private Integer numberOfBranches;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getNzbn() { return nzbn; }
    public void setNzbn(String nzbn) { this.nzbn = nzbn; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getLiaisonName() { return liaisonName; }
    public void setLiaisonName(String liaisonName) { this.liaisonName = liaisonName; }
    public String getLiaisonEmail() { return liaisonEmail; }
    public void setLiaisonEmail(String liaisonEmail) { this.liaisonEmail = liaisonEmail; }
    public String getLiaisonContactNumber() { return liaisonContactNumber; }
    public void setLiaisonContactNumber(String liaisonContactNumber) { this.liaisonContactNumber = liaisonContactNumber; }
    public String getComplianceOfficerName() { return complianceOfficerName; }
    public void setComplianceOfficerName(String complianceOfficerName) { this.complianceOfficerName = complianceOfficerName; }
    public String getComplianceOfficerEmail() { return complianceOfficerEmail; }
    public void setComplianceOfficerEmail(String complianceOfficerEmail) { this.complianceOfficerEmail = complianceOfficerEmail; }
    public String getComplianceOfficerContactNumber() { return complianceOfficerContactNumber; }
    public void setComplianceOfficerContactNumber(String complianceOfficerContactNumber) { this.complianceOfficerContactNumber = complianceOfficerContactNumber; }
    public Integer getNumberOfBranches() { return numberOfBranches; }
    public void setNumberOfBranches(Integer numberOfBranches) { this.numberOfBranches = numberOfBranches; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
