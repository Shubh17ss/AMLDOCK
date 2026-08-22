package nz.amldock.ownership;

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

@Entity
@Table(name = "ownership_node")
public class OwnershipNode extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ownership_structure_id", nullable = false)
    private Long ownershipStructureId;

    @Enumerated(EnumType.STRING)
    @Column(name = "node_type", nullable = false, length = 32)
    private NodeType nodeType;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    // ---- Natural person ----
    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "id_document_type", length = 32)
    private String idDocumentType; // DRIVER_LICENCE / PASSPORT — kept as string for flex

    @Column(name = "id_document_number", length = 64)
    private String idDocumentNumber;

    @Column(name = "id_document_country", length = 3)
    private String idDocumentCountry;

    // ---- Company ----
    /**
     * NZBN, ABN or a foreign registration number, depending on {@link #jurisdictionCountry}.
     * Renamed from nzbn in V35 — the column has always been able to hold a non-NZ identifier.
     */
    @Column(name = "business_number", length = 32)
    private String businessNumber;

    @Column(name = "company_number", length = 64)
    private String companyNumber;

    @Column(name = "incorporation_date")
    private LocalDate incorporationDate;

    @Column(name = "registered_office", columnDefinition = "text")
    private String registeredOffice;

    // ---- Trust ----
    @Column(name = "trust_name")
    private String trustName;

    @Column(name = "trust_deed_document_id")
    private Long trustDeedDocumentId;

    @Column(name = "settlor_name")
    private String settlorName;

    // ---- Future / LLM-extracted free-form data ----
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_json", columnDefinition = "jsonb")
    private String extraJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 32)
    private NodeVerificationStatus verificationStatus = NodeVerificationStatus.IN_PROGRESS;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "verification_notes", columnDefinition = "text")
    private String verificationNotes;

    /**
     * The person this node represents. Every INDIVIDUAL has one from V34 — extraction-created
     * nodes get theirs at upload, hand-added ones when the node is created — because the shared
     * contact and background fields live on that record. Null for every other type.
     */
    @Column(name = "beneficial_owner_id")
    private Long beneficialOwnerId;

    /**
     * The capacity this individual appears in <em>on this deal</em>. Null for entity types.
     *
     * <p>Per-deal by design: shared person facts live on {@code beneficial_owner}, but a trustee
     * here can be a guarantor on the next deal.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "person_role", length = 32)
    private PersonRole personRole;

    /**
     * Free text. The form prompts for a link to a previous deal, but a file-note or external
     * system reference is just as legitimate, so nothing parses this.
     */
    @Column(name = "reference")
    private String reference;

    /* ---------- private company (V35) ---------- */

    /**
     * ISO 3166-1 alpha-2. Where the entity is incorporated, registered or otherwise governed.
     *
     * <p>One column, labelled per type: "Country of incorporation" for a company or limited
     * partnership, "Jurisdiction" for a society, charity, agency or estate — none of which is
     * incorporated anywhere. Also decides how {@link #businessNumber} is labelled.
     */
    @Column(name = "jurisdiction_country", length = 2)
    private String jurisdictionCountry;

    @Column(name = "company_has_constitution")
    private Boolean companyHasConstitution;

    /**
     * Whether an intermediary stands in for the real party: a nominee director or shareholder
     * on a company, a nominee limited partner on a limited partnership. YES raises the deal to
     * HIGH — see {@code DealRiskService}.
     *
     * <p>Boxed and nullable rather than defaulted to NOT_ASKED in the field initialiser: the
     * types that are never asked leave this null, and a trust reading "not asked" about a
     * question nobody was going to put to it is noise in the record.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "nominee_status", length = 16)
    private NomineeStatus nomineeStatus;

    /** TRUE raises the deal to HIGH — see {@code DealRiskService}. */
    @Column(name = "company_complex_ownership")
    private Boolean companyComplexOwnership;

    @Column(name = "company_personal_assets")
    private Boolean companyPersonalAssets;

    @Column(name = "company_new_developer")
    private Boolean companyNewDeveloper;

    /* ---------- trust (V36) ---------- */

    @Enumerated(EnumType.STRING)
    @Column(name = "trust_type", length = 48)
    private TrustType trustType;

    @Column(name = "trust_discretionary")
    private Boolean trustDiscretionary;

    /** EXTENSIVE_DIVERSE_PORTFOLIO raises the deal to HIGH — see {@code DealRiskService}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "trust_holding_complexity", length = 48)
    private TrustHoldingComplexity trustHoldingComplexity;

    /* ---------- partnership (V37) ---------- */

    /**
     * Where the entity says its money comes from.
     *
     * <p>Node-level, and distinct from {@code beneficial_owner.source_of_funds}: that one
     * belongs to a person and follows them across deals, and a partnership is not a person.
     */
    @Column(name = "source_of_funds", columnDefinition = "text")
    private String sourceOfFunds;

    public Long getId() { return id; }
    public Long getOwnershipStructureId() { return ownershipStructureId; }
    public void setOwnershipStructureId(Long v) { this.ownershipStructureId = v; }
    public NodeType getNodeType() { return nodeType; }
    public void setNodeType(NodeType v) { this.nodeType = v; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate v) { this.dateOfBirth = v; }
    public String getIdDocumentType() { return idDocumentType; }
    public void setIdDocumentType(String v) { this.idDocumentType = v; }
    public String getIdDocumentNumber() { return idDocumentNumber; }
    public void setIdDocumentNumber(String v) { this.idDocumentNumber = v; }
    public String getIdDocumentCountry() { return idDocumentCountry; }
    public void setIdDocumentCountry(String v) { this.idDocumentCountry = v; }
    public String getBusinessNumber() { return businessNumber; }
    public void setBusinessNumber(String v) { this.businessNumber = v; }
    public String getCompanyNumber() { return companyNumber; }
    public void setCompanyNumber(String v) { this.companyNumber = v; }
    public LocalDate getIncorporationDate() { return incorporationDate; }
    public void setIncorporationDate(LocalDate v) { this.incorporationDate = v; }
    public String getRegisteredOffice() { return registeredOffice; }
    public void setRegisteredOffice(String v) { this.registeredOffice = v; }
    public String getTrustName() { return trustName; }
    public void setTrustName(String v) { this.trustName = v; }
    public Long getTrustDeedDocumentId() { return trustDeedDocumentId; }
    public void setTrustDeedDocumentId(Long v) { this.trustDeedDocumentId = v; }
    public String getSettlorName() { return settlorName; }
    public void setSettlorName(String v) { this.settlorName = v; }
    public String getExtraJson() { return extraJson; }
    public void setExtraJson(String v) { this.extraJson = v; }
    public NodeVerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(NodeVerificationStatus v) { this.verificationStatus = v; }
    public String getNotes() { return notes; }
    public void setNotes(String v) { this.notes = v; }
    public String getVerificationNotes() { return verificationNotes; }
    public void setVerificationNotes(String v) { this.verificationNotes = v; }
    public Long getBeneficialOwnerId() { return beneficialOwnerId; }
    public void setBeneficialOwnerId(Long v) { this.beneficialOwnerId = v; }
    public PersonRole getPersonRole() { return personRole; }
    public void setPersonRole(PersonRole v) { this.personRole = v; }
    public String getReference() { return reference; }
    public void setReference(String v) { this.reference = v; }
    public String getJurisdictionCountry() { return jurisdictionCountry; }
    public void setJurisdictionCountry(String v) { this.jurisdictionCountry = v; }
    public Boolean getCompanyHasConstitution() { return companyHasConstitution; }
    public void setCompanyHasConstitution(Boolean v) { this.companyHasConstitution = v; }
    public NomineeStatus getNomineeStatus() { return nomineeStatus; }
    public void setNomineeStatus(NomineeStatus v) { this.nomineeStatus = v; }
    public Boolean getCompanyComplexOwnership() { return companyComplexOwnership; }
    public void setCompanyComplexOwnership(Boolean v) { this.companyComplexOwnership = v; }
    public Boolean getCompanyPersonalAssets() { return companyPersonalAssets; }
    public void setCompanyPersonalAssets(Boolean v) { this.companyPersonalAssets = v; }
    public Boolean getCompanyNewDeveloper() { return companyNewDeveloper; }
    public void setCompanyNewDeveloper(Boolean v) { this.companyNewDeveloper = v; }
    public TrustType getTrustType() { return trustType; }
    public void setTrustType(TrustType v) { this.trustType = v; }
    public Boolean getTrustDiscretionary() { return trustDiscretionary; }
    public void setTrustDiscretionary(Boolean v) { this.trustDiscretionary = v; }
    public TrustHoldingComplexity getTrustHoldingComplexity() { return trustHoldingComplexity; }
    public void setTrustHoldingComplexity(TrustHoldingComplexity v) { this.trustHoldingComplexity = v; }
    public String getSourceOfFunds() { return sourceOfFunds; }
    public void setSourceOfFunds(String v) { this.sourceOfFunds = v; }
}
