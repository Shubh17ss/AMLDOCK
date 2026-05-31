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

    // ---- NZ company ----
    @Column(length = 32)
    private String nzbn;

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
    public String getNzbn() { return nzbn; }
    public void setNzbn(String v) { this.nzbn = v; }
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
}
