package nz.amldock.dealnote;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import nz.amldock.common.audit.BaseEntity;
import nz.amldock.deal.DealStatus;

/**
 * One entry in a deal's notes timeline: either a comment, or the note attached to a state change.
 *
 * <p>Append-only. Nothing edits or deletes these — a compliance thread that can be rewritten
 * afterwards is worth less than no thread at all.
 *
 * <p>The broker's own note is <em>not</em> stored here. It lives on {@code Deal.notes} so it
 * stays editable while the deal is NEW, and {@link DealNoteService} synthesises it as the
 * timeline's opening entry.
 */
@Entity
@Table(name = "deal_note")
public class DealNote extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deal_id", nullable = false)
    private Long dealId;

    @Column(name = "author_user_id", nullable = false)
    private Long authorUserId;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    /**
     * Both null for a comment, both set for a state change. The DB enforces the pairing
     * (chk_deal_note_transition), so an entry can never claim half a transition.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status_from", length = 16)
    private DealStatus statusFrom;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_to", length = 16)
    private DealStatus statusTo;

    public Long getId() { return id; }
    public Long getDealId() { return dealId; }
    public void setDealId(Long v) { this.dealId = v; }
    public Long getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(Long v) { this.authorUserId = v; }
    public String getBody() { return body; }
    public void setBody(String v) { this.body = v; }
    public DealStatus getStatusFrom() { return statusFrom; }
    public void setStatusFrom(DealStatus v) { this.statusFrom = v; }
    public DealStatus getStatusTo() { return statusTo; }
    public void setStatusTo(DealStatus v) { this.statusTo = v; }
}
