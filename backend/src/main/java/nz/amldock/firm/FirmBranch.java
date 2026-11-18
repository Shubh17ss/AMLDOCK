package nz.amldock.firm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;

import java.time.Instant;

@Entity
@Table(name = "firm_branch")
public class FirmBranch extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** What URLs and the /firms and /branches endpoints name this row by. See FirmPublicIds. */
    @Column(name = "public_id", nullable = false, unique = true, length = 12, updatable = false)
    private String publicId;

    @Column(name = "real_estate_firm_id", nullable = false)
    private Long realEstateFirmId;

    @Column(nullable = false)
    private String name;

    @Column(name = "address_line1")
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    private String suburb;
    private String city;
    private String postcode;
    private String phone;
    private String email;

    @Column(name = "manager_name")
    private String managerName;

    @Column(name = "manager_email")
    private String managerEmail;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    /** Starts the retention hold; the jurisdiction is the entity's. See RetentionPolicy. */
    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    /** MANUAL or FIRM while inactive, null while active. */
    @Enumerated(EnumType.STRING)
    @Column(name = "deactivation_source", length = 10)
    private DeactivationSource deactivationSource;

    public Long getId() { return id; }
    public String getPublicId() { return publicId; }

    @PrePersist
    void assignPublicId() {
        if (publicId == null) publicId = FirmPublicIds.newId();
    }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long realEstateFirmId) { this.realEstateFirmId = realEstateFirmId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddressLine1() { return addressLine1; }
    public void setAddressLine1(String addressLine1) { this.addressLine1 = addressLine1; }
    public String getAddressLine2() { return addressLine2; }
    public void setAddressLine2(String addressLine2) { this.addressLine2 = addressLine2; }
    public String getSuburb() { return suburb; }
    public void setSuburb(String suburb) { this.suburb = suburb; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getPostcode() { return postcode; }
    public void setPostcode(String postcode) { this.postcode = postcode; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getManagerName() { return managerName; }
    public void setManagerName(String managerName) { this.managerName = managerName; }
    public String getManagerEmail() { return managerEmail; }
    public void setManagerEmail(String managerEmail) { this.managerEmail = managerEmail; }
    public boolean isActive() { return active; }
    public Instant getDeactivatedAt() { return deactivatedAt; }
    public DeactivationSource getDeactivationSource() { return deactivationSource; }

    /** Switching off this way counts as by hand; use {@link #deactivate} to name another cause. */
    public void setActive(boolean active) {
        if (active) activate();
        else deactivate(DeactivationSource.MANUAL);
    }

    public void activate() {
        if (this.active) return;
        this.active = true;
        this.deactivatedAt = null;
        this.deactivationSource = null;
    }

    public void deactivate(DeactivationSource source) {
        if (source == DeactivationSource.BRANCH) {
            throw new IllegalArgumentException("A branch is switched off by hand or by its entity");
        }
        if (!this.active) return;
        this.active = false;
        this.deactivatedAt = Instant.now();
        this.deactivationSource = source;
    }
}
