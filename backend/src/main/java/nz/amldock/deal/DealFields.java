package nz.amldock.deal;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;
import nz.amldock.common.audit.BaseEntity;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Every column a deal carries, spelled once.
 *
 * <p>Extracted from {@link Deal} so that {@link nz.amldock.deal.version.DealVersion} — the copy
 * written each time a deal is verified — can hold the same columns without a second transcription
 * of them. The two tables must agree: a version that quietly stopped capturing a column added
 * later would be a snapshot with a hole in it, and nothing in a review would reveal that.
 *
 * <p>{@code @MappedSuperclass} has no schema of its own; the columns land in whichever table the
 * concrete entity names. So {@code deal} is unchanged by this, and {@code deal_version} is
 * <em>required</em> to carry the same columns — {@code ddl-auto: validate} refuses to start
 * otherwise. That startup failure is the point: it turns "the migration forgot a column" from
 * something a reviewer might notice into something the build cannot get past.
 *
 * <p>The id is deliberately not here. Each table generates its own.
 */
@MappedSuperclass
public abstract class DealFields extends BaseEntity {


    @Column(unique = true)
    private String reference;

    @Column(name = "firm_branch_id", nullable = false)
    private Long firmBranchId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DealStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 32)
    private TransactionType transactionType;

    /** In the reporting entity's own currency — see RealEstateFirm.country. */
    @Column(name = "transaction_value")
    private BigDecimal transactionValue;

    @Column(name = "poc_name") private String pocName;
    @Column(name = "poc_role") private String pocRole;
    @Column(name = "poc_phone") private String pocPhone;
    @Column(name = "poc_email") private String pocEmail;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    /**
     * The broker's own note (section 4 of the deal form). Editable while the deal is NEW, and
     * rendered as the opening entry of the deal's notes timeline — see DealNoteService, which
     * synthesises that entry rather than copying this into deal_note.
     */
    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    /* ---------- broker's compliance answers (V28, sections 2 and 4) ---------- */

    /** Why the transaction is happening, in the broker's own words (section 2). */
    @Column(name = "transaction_purpose", columnDefinition = "text")
    private String transactionPurpose;

    @Column(name = "trust_involved")
    private Boolean trustInvolved;

    /**
     * How long the client has held the property, as the two boxes the form asks for. Both null
     * until answered; months is the remainder beside years, so 18 months is stored as 1 and 6.
     *
     * <p>Replaced {@code on_sold_quickly} in V46. That question asked the broker to judge a
     * threshold nobody had written down; this one asks for a fact, and scores it in bands —
     * see {@link DealRiskService}.
     */
    @Column(name = "ownership_tenure_years")
    private Integer ownershipTenureYears;

    @Column(name = "ownership_tenure_months")
    private Integer ownershipTenureMonths;

    /**
     * Whether the broker met the client in person <em>and</em> sighted their original IDs.
     * Null until answered; answering No adds to the risk score.
     *
     * <p>Not the same question as {@link #clientRemote}, which asks only whether they met. A
     * broker can meet someone and see nothing, and only one of those two facts is evidence that
     * an identity was checked.
     */
    @Column(name = "face_to_face_id_verified")
    private Boolean faceToFaceIdVerified;

    /**
     * Which individual on the ownership structure is the deal's point of contact.
     *
     * <p>The counterpart to {@link #pocName}, not a replacement for it: that one is free text a
     * broker types at creation, before any structure exists to choose from. This is what
     * compliance nominates once it does, and it names a row rather than a spelling.
     *
     * <p>{@code ON DELETE SET NULL} — removing an owner is a legitimate edit, and must neither be
     * blocked by a nomination nor silently repoint it at somebody else.
     */
    @Column(name = "key_contact_node_id")
    private Long keyContactNodeId;

    /**
     * ISO 3166-1 alpha-2, or the literal {@code "NONE"} for "asked, and there is none".
     * {@code null} means not answered yet — a distinct compliance fact worth keeping.
     */
    @Column(name = "foreign_exposure_country", length = 4)
    private String foreignExposureCountry;

    @Column(name = "red_flag_present")
    private Boolean redFlagPresent;

    /**
     * Which red flag, when {@link #redFlagPresent} is true. A {@code RedFlag} enum name, stored
     * as a plain string with no CHECK constraint so the option list can grow without a migration
     * — the same arrangement suspicious_activity.red_flag uses, and the same enum behind both.
     */
    @Column(name = "red_flag", length = 64)
    private String redFlag;

    /**
     * Whether the broker has met the client face to face (V29, section 3). Captured to trigger
     * remote identity verification later; deliberately not an input to the risk rating — see
     * {@code DealService.applyRiskRating}.
     */
    @Column(name = "client_remote")
    private Boolean clientRemote;

    /** Broker's valuation range, in the reporting entity's own currency. */
    @Column(name = "valuation_min")
    private BigDecimal valuationMin;

    @Column(name = "valuation_max")
    private BigDecimal valuationMax;

    /**
     * The score behind {@link #riskRating}, accumulated by {@link DealRiskService} from every
     * answer that bears on risk. Derived server-side; never accepted from the client.
     *
     * <p>Kept even while the rating is pinned by an override, because the Risk tab shows the
     * calculated position beside the pinned one and a reviewer deciding whether to lift an
     * override needs to see what the file would say on its own.
     */
    @Column(name = "risk_value", nullable = false)
    private int riskValue = 0;

    /** Derived server-side; never accepted from the client. Null on pre-V28 deals. */
    @Enumerated(EnumType.STRING)
    @Column(name = "risk_rating", length = 16)
    private RiskRating riskRating;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_rating_source", nullable = false, length = 16)
    private RiskRatingSource riskRatingSource = RiskRatingSource.DERIVED;

    /**
     * Whether a reviewer has signed off the rating.
     *
     * <p>A sign-off on a specific score, so it falls back to false whenever {@link #riskValue}
     * moves — see {@link DealRiskService#apply}. An approval that survived the answers it was
     * given about would be a claim nobody made.
     */
    @Column(name = "risk_approved", nullable = false)
    private boolean riskApproved = false;

    /** Why a reviewer pinned the rating by hand. Only meaningful while the source is OVERRIDE. */
    @Column(name = "risk_override_comment", columnDefinition = "text")
    private String riskOverrideComment;

    @Column(name = "risk_approved_by_user_id")
    private Long riskApprovedByUserId;

    @Column(name = "risk_approved_at")
    private Instant riskApprovedAt;

    @Column(name = "decided_by_user_id")
    private Long decidedByUserId;

    @Column(name = "decided_at")
    private Instant decidedAt;

    public String getReference() { return reference; }
    public void setReference(String v) { this.reference = v; }
    public Long getFirmBranchId() { return firmBranchId; }
    public void setFirmBranchId(Long v) { this.firmBranchId = v; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long v) { this.propertyId = v; }
    public Long getClientId() { return clientId; }
    public void setClientId(Long v) { this.clientId = v; }
    public DealStatus getStatus() { return status; }
    public void setStatus(DealStatus v) { this.status = v; }
    public TransactionType getTransactionType() { return transactionType; }
    public void setTransactionType(TransactionType v) { this.transactionType = v; }
    public BigDecimal getTransactionValue() { return transactionValue; }
    public void setTransactionValue(BigDecimal v) { this.transactionValue = v; }
    public String getPocName() { return pocName; }
    public void setPocName(String v) { this.pocName = v; }
    public String getPocRole() { return pocRole; }
    public void setPocRole(String v) { this.pocRole = v; }
    public String getPocPhone() { return pocPhone; }
    public void setPocPhone(String v) { this.pocPhone = v; }
    public String getPocEmail() { return pocEmail; }
    public void setPocEmail(String v) { this.pocEmail = v; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long v) { this.createdByUserId = v; }
    public String getNotes() { return notes; }
    public void setNotes(String v) { this.notes = v; }
    public Long getDecidedByUserId() { return decidedByUserId; }
    public void setDecidedByUserId(Long v) { this.decidedByUserId = v; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant v) { this.decidedAt = v; }
    public String getTransactionPurpose() { return transactionPurpose; }
    public void setTransactionPurpose(String v) { this.transactionPurpose = v; }
    public Boolean getTrustInvolved() { return trustInvolved; }
    public void setTrustInvolved(Boolean v) { this.trustInvolved = v; }
    public Integer getOwnershipTenureYears() { return ownershipTenureYears; }
    public void setOwnershipTenureYears(Integer v) { this.ownershipTenureYears = v; }
    public Integer getOwnershipTenureMonths() { return ownershipTenureMonths; }
    public void setOwnershipTenureMonths(Integer v) { this.ownershipTenureMonths = v; }
    public Boolean getFaceToFaceIdVerified() { return faceToFaceIdVerified; }
    public void setFaceToFaceIdVerified(Boolean v) { this.faceToFaceIdVerified = v; }
    public Long getKeyContactNodeId() { return keyContactNodeId; }
    public void setKeyContactNodeId(Long v) { this.keyContactNodeId = v; }
    public String getForeignExposureCountry() { return foreignExposureCountry; }
    public void setForeignExposureCountry(String v) { this.foreignExposureCountry = v; }
    public Boolean getRedFlagPresent() { return redFlagPresent; }
    public void setRedFlagPresent(Boolean v) { this.redFlagPresent = v; }

    public String getRedFlag() { return redFlag; }
    public void setRedFlag(String v) { this.redFlag = v; }
    public Boolean getClientRemote() { return clientRemote; }
    public void setClientRemote(Boolean v) { this.clientRemote = v; }
    public BigDecimal getValuationMin() { return valuationMin; }
    public void setValuationMin(BigDecimal v) { this.valuationMin = v; }
    public BigDecimal getValuationMax() { return valuationMax; }
    public void setValuationMax(BigDecimal v) { this.valuationMax = v; }
    public RiskRating getRiskRating() { return riskRating; }
    public void setRiskRating(RiskRating v) { this.riskRating = v; }
    public RiskRatingSource getRiskRatingSource() { return riskRatingSource; }
    public void setRiskRatingSource(RiskRatingSource v) { this.riskRatingSource = v; }
    public int getRiskValue() { return riskValue; }
    public void setRiskValue(int v) { this.riskValue = v; }
    public boolean isRiskApproved() { return riskApproved; }
    public void setRiskApproved(boolean v) { this.riskApproved = v; }
    public String getRiskOverrideComment() { return riskOverrideComment; }
    public void setRiskOverrideComment(String v) { this.riskOverrideComment = v; }
    public Long getRiskApprovedByUserId() { return riskApprovedByUserId; }
    public void setRiskApprovedByUserId(Long v) { this.riskApprovedByUserId = v; }
    public Instant getRiskApprovedAt() { return riskApprovedAt; }
    public void setRiskApprovedAt(Instant v) { this.riskApprovedAt = v; }

    /**
     * The id of the deal these columns describe.
     *
     * <p>On the live entity that is the row's own id; on the deal's per-version copy it is
     * the id of the row that was frozen, not the copy's. DTOs built from either side have to
     * agree on what an id means — an edge naming a node, a link naming a deal — so this is the
     * one they read, and {@code getId()} stays each table's own primary key.
     */
    public abstract Long getDealId();
}
