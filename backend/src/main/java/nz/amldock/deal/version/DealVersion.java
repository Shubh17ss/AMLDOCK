package nz.amldock.deal.version;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealFields;
import org.springframework.beans.BeanUtils;

import java.time.Instant;

/**
 * One verification of a deal, and the deal as it stood at that moment.
 *
 * <p>Extends {@link DealFields}, so it carries every column {@link Deal} carries — see that class
 * for why the two are declared together rather than transcribed apart. What it adds is the
 * sign-off: who verified it, when, and on what note.
 *
 * <p>That sign-off lives here rather than on the deal because the deal does not keep it. Reopening
 * moves the deal to REVIEW, and {@code DealLifecycleService.stampDecision} clears
 * {@code decidedByUserId} / {@code decidedAt} on any move off the verified line — correctly, since
 * the live deal is no longer verified. The version is where the sign-off goes on being true.
 */
@Entity
@Table(name = "deal_version")
public class DealVersion extends DealFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false, updatable = false)
    private Long dealId;

    @Column(name = "version_no", nullable = false, updatable = false)
    private Integer versionNo;

    @Column(name = "verified_by_user_id", nullable = false, updatable = false)
    private Long verifiedByUserId;

    @Column(name = "verified_at", nullable = false, updatable = false)
    private Instant verifiedAt;

    @Column(name = "verify_note", nullable = false, updatable = false, columnDefinition = "text")
    private String verifyNote;

    /* ---------- the one thing about a version that is written later ---------- */

    @Column(name = "reopened_by_user_id")
    private Long reopenedByUserId;

    @Column(name = "reopened_at")
    private Instant reopenedAt;

    @Column(name = "reopen_note", columnDefinition = "text")
    private String reopenNote;

    /* ---------- the ownership structure's own two columns ---------- */

    /** The <em>source</em> node id, as {@code deal_version_node.source_node_id} records it. */
    @Column(name = "root_node_id")
    private Long rootNodeId;

    @Column(name = "structure_notes", columnDefinition = "text")
    private String structureNotes;

    /**
     * The deal's timestamps are copied, not stamped — see
     * {@link nz.amldock.common.audit.BaseEntity#stampsOwnTimestamps()}. When this row was written
     * is {@link #verifiedAt}, which is stated rather than inferred from a housekeeping column.
     */
    @Override
    protected boolean stampsOwnTimestamps() { return false; }

    /**
     * Freezes a deal.
     *
     * <p>{@code BeanUtils} copies by property name across the shared {@link DealFields}, so the
     * column list is not spelled a third time here. It cannot reach {@code createdAt} /
     * {@code updatedAt} — {@code BaseEntity} exposes getters but no setters, deliberately — so
     * those two are carried over by hand.
     */
    public static DealVersion copyOf(Deal deal, int versionNo, Long verifierId, String verifyNote) {
        DealVersion v = new DealVersion();
        BeanUtils.copyProperties(deal, v);
        v.createdAt = deal.getCreatedAt();
        v.updatedAt = deal.getUpdatedAt();
        v.dealId = deal.getId();
        v.versionNo = versionNo;
        v.verifiedByUserId = verifierId;
        v.verifiedAt = Instant.now();
        v.verifyNote = verifyNote;
        return v;
    }

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public Integer getVersionNo() { return versionNo; }
    public Long getVerifiedByUserId() { return verifiedByUserId; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public String getVerifyNote() { return verifyNote; }
    public Long getReopenedByUserId() { return reopenedByUserId; }
    public void setReopenedByUserId(Long v) { this.reopenedByUserId = v; }
    public Instant getReopenedAt() { return reopenedAt; }
    public void setReopenedAt(Instant v) { this.reopenedAt = v; }
    public String getReopenNote() { return reopenNote; }
    public void setReopenNote(String v) { this.reopenNote = v; }
    public Long getRootNodeId() { return rootNodeId; }
    public void setRootNodeId(Long v) { this.rootNodeId = v; }
    public String getStructureNotes() { return structureNotes; }
    public void setStructureNotes(String v) { this.structureNotes = v; }
}
