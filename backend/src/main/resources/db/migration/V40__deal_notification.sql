-- V40: per-user, per-branch email notification preferences for deal events, and the outbox that
-- delivers them.
--
-- The outbox lives in the database rather than on a broker for the same reason V30's OCR queue
-- does: the work item is written in the *same transaction* as the deal it describes
-- (DealService.create / act / override), so a rolled-back deal cannot leave an email behind and a
-- committed one cannot lose its notification. Publishing to SQS or straight to SES at commit time
-- would reintroduce exactly the dual-write window this table exists to close.
--
-- Delivery is at-least-once, and deliberately so. A worker that dies between SES accepting an
-- entry and the SENT write will have its lease reclaimed and send again. A duplicate deal
-- notification is a mild annoyance; a dedupe key that has to outlive the row is a consistency
-- problem of its own, and not worth buying with the trade.
--
-- No preference rows are seeded. A missing row means "the default for this user's role", resolved
-- in NotificationDefaults at read time. Seeding would have needed six correctly-placed hooks
-- (UserService.create, createBulk and update; BranchService.create;
-- FirmService.createPlaceholderBranches, which bypasses BranchService entirely; and a back-fill
-- here) and would have failed *silently* — a missed hook means somebody quietly stops receiving
-- mail, with no symptom to notice. Absence-means-default cannot fail that way.

CREATE TABLE deal_notification_preference (
    id                 BIGSERIAL PRIMARY KEY,
    app_user_id        BIGINT      NOT NULL REFERENCES app_user(id)    ON DELETE CASCADE,
    -- Always the branch the *deal* is in, never the user's own. For branch-level staff the two
    -- coincide; for a firm-level officer, who has no branch of their own, this column is what
    -- lets them subscribe per branch. Keeping the shape uniform means it does all the scoping
    -- work at send time, and the two shapes of the UI are two projections of one table.
    firm_branch_id     BIGINT      NOT NULL REFERENCES firm_branch(id) ON DELETE CASCADE,
    event_type         VARCHAR(48) NOT NULL,
    -- A row records a *deviation* from the role default, so this is meaningful in both states.
    enabled            BOOLEAN     NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL,
    updated_at         TIMESTAMPTZ NOT NULL,
    -- Who last changed it — the user themselves, or an officer overriding from Settings.
    updated_by_user_id BIGINT      REFERENCES app_user(id) ON DELETE SET NULL,
    CONSTRAINT uq_deal_notification_preference UNIQUE (app_user_id, firm_branch_id, event_type),
    -- The extension point. A new event is: widen this CHECK, widen the one below, add a value to
    -- DealNotificationEvent. Nothing structural changes.
    CONSTRAINT chk_deal_notification_preference_event CHECK (
        event_type IN ('DEAL_CREATED', 'DEAL_STATUS_CHANGED')
    )
);

-- "Every preference this user holds" — one query per Profile page load.
CREATE INDEX idx_dnp_user ON deal_notification_preference (app_user_id);
-- "Who, in this branch, wants this event" — the send path.
CREATE INDEX idx_dnp_branch_event ON deal_notification_preference (firm_branch_id, event_type);


CREATE TABLE deal_notification (
    id                BIGSERIAL PRIMARY KEY,
    deal_id           BIGINT       NOT NULL REFERENCES deal(id)     ON DELETE CASCADE,
    event_type        VARCHAR(48)  NOT NULL,
    recipient_user_id BIGINT       NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    -- Snapshotted, not joined. Someone whose address changes between enqueue and send should be
    -- reached at the address that was current when the event happened.
    recipient_email   VARCHAR(255) NOT NULL,
    -- Becomes the per-recipient SES replacementTemplateData. The email renders from this and
    -- never from a live re-read of the deal: a deal whose status moves again before the poller
    -- runs still produces a correct email for the earlier event, and a deal moved between
    -- branches (DealService.update permits that) still names the branch it was in at the time.
    payload           JSONB        NOT NULL,
    status            VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    attempt_count     INT          NOT NULL DEFAULT 0,
    -- When this row next becomes eligible. NULL means "immediately" — a freshly enqueued
    -- notification has no backoff to serve.
    next_attempt_at   TIMESTAMPTZ,
    -- Set when a worker claims the row. Its age is what makes a crashed worker's claim
    -- collectable; without it an abandoned IN_PROGRESS row is indistinguishable from one being
    -- actively worked.
    claimed_at        TIMESTAMPTZ,
    error             TEXT,
    ses_message_id    VARCHAR(255),
    created_at        TIMESTAMPTZ  NOT NULL,
    sent_at           TIMESTAMPTZ,
    CONSTRAINT chk_deal_notification_status CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'SENT', 'FAILED')
    ),
    CONSTRAINT chk_deal_notification_event CHECK (
        event_type IN ('DEAL_CREATED', 'DEAL_STATUS_CHANGED')
    )
);

-- Partial, exactly as idx_document_ocr_claimable is and for the same reason: it holds only
-- in-flight rows, so a poll costs O(backlog) rather than O(table) and degenerates to a no-op once
-- the queue drains. That is what makes polling every few seconds cheap enough to run beside
-- request traffic.
--
-- The id tiebreak is load-bearing beyond ordering: rows for one event are inserted together and
-- so take adjacent ids, which is what lets the dispatcher group a claimed batch by
-- (deal_id, event_type) into a single SES SendBulkEmail call.
CREATE INDEX idx_deal_notification_claimable ON deal_notification (next_attempt_at, id)
    WHERE status IN ('PENDING', 'IN_PROGRESS');

-- Serves the retention sweep. SENT rows are redundant once DEAL_NOTIFICATION_EMAIL_SENT is on the
-- audit trail; FAILED rows are kept indefinitely, because those are the ones somebody needs.
CREATE INDEX idx_deal_notification_sent_at ON deal_notification (sent_at)
    WHERE status = 'SENT';
