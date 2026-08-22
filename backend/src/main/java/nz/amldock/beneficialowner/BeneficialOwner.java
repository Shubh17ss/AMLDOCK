package nz.amldock.beneficialowner;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;

/**
 * A natural person identified from a scanned ID.
 *
 * <p>This is <em>who someone is</em>, scoped to a reporting entity and reusable across that
 * firm's deals. Where they sit in a particular deal's ownership graph is a separate concern,
 * held by {@link nz.amldock.ownership.OwnershipNode}.
 *
 * <p>Name, date of birth and expiry are all nullable: extraction returns what it could read,
 * and a field it could not read stays null rather than being filled with a guess.
 */
@Entity
@Table(name = "beneficial_owner")
public class BeneficialOwner extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "real_estate_firm_id", nullable = false)
    private Long realEstateFirmId;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "id_expiry_date")
    private LocalDate idExpiryDate;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extraction_confidence", columnDefinition = "jsonb")
    private String extractionConfidence;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", nullable = false, length = 32)
    private ReviewStatus reviewStatus = ReviewStatus.UNREVIEWED;

    /* ---------- entered by hand, and shared across every deal this person is on (V34) ---------- */

    /**
     * Unvalidated beyond length. A CDD record holds what the client gave; an address rejected
     * for looking wrong is a fact lost rather than a mistake prevented.
     */
    @Column(name = "email", length = 320)
    private String email;

    /** ISO 3166-1 alpha-2. Kept apart from the number so the flag has something to render. */
    @Column(name = "phone_country", length = 2)
    private String phoneCountry;

    /** The national significant number, as typed. Not normalised — see {@link #email}. */
    @Column(name = "phone_number", length = 32)
    private String phoneNumber;

    @Column(name = "occupation")
    private String occupation;

    /** Source of wealth and of funds together: one question, asked and answered in one breath. */
    @Column(name = "source_of_funds", columnDefinition = "text")
    private String sourceOfFunds;

    public Long getId() { return id; }
    public Long getRealEstateFirmId() { return realEstateFirmId; }
    public void setRealEstateFirmId(Long v) { this.realEstateFirmId = v; }
    public String getFullName() { return fullName; }
    public void setFullName(String v) { this.fullName = v; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate v) { this.dateOfBirth = v; }
    public LocalDate getIdExpiryDate() { return idExpiryDate; }
    public void setIdExpiryDate(LocalDate v) { this.idExpiryDate = v; }
    public String getExtractionConfidence() { return extractionConfidence; }
    public void setExtractionConfidence(String v) { this.extractionConfidence = v; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus v) { this.reviewStatus = v; }
    public String getEmail() { return email; }
    public void setEmail(String v) { this.email = v; }
    public String getPhoneCountry() { return phoneCountry; }
    public void setPhoneCountry(String v) { this.phoneCountry = v; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String v) { this.phoneNumber = v; }
    public String getOccupation() { return occupation; }
    public void setOccupation(String v) { this.occupation = v; }
    public String getSourceOfFunds() { return sourceOfFunds; }
    public void setSourceOfFunds(String v) { this.sourceOfFunds = v; }
}
