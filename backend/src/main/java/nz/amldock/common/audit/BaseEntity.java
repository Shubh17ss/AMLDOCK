package nz.amldock.common.audit;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

import java.time.Instant;

@MappedSuperclass
public abstract class BaseEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    protected Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    protected Instant updatedAt;

    /**
     * Whether these timestamps describe <em>this</em> row.
     *
     * <p>True for everything the application creates and edits, which is why it is the default.
     *
     * <p>The deal's snapshot rows ({@code nz.amldock.deal.version}) answer false. Their
     * {@code created_at} and {@code updated_at} are copied from the row they froze and describe
     * that row's life — when the original deal was raised, when the node was last corrected. Left
     * to stamp themselves they would all read as the moment of verification, which is a fact the
     * snapshot already records properly in {@code deal_version.verified_at}, and would destroy
     * the one it was copying.
     */
    protected boolean stampsOwnTimestamps() { return true; }

    @PrePersist
    void onCreate() {
        if (!stampsOwnTimestamps()) return;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        if (!stampsOwnTimestamps()) return;
        this.updatedAt = Instant.now();
    }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
