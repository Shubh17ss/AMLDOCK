/*
 * ASSURANCE: A SECOND LOOK AT A SIGNED-OFF VERSION.
 *
 * Verification is compliance signing a deal off. Assurance is compliance coming back afterwards -
 * an AML compliance officer or senior manager reviewing that sign-off and recording whether it
 * holds up. It is per version, because a sign-off is per version: v2 can be assured while v3,
 * written after a reopen, has not been looked at yet.
 *
 * Only the current position is kept, on the version row itself. Who marked it and when is stated
 * alongside, and every mark also goes to audit_log, which is where the history of changes lives.
 *
 * NOT ON DealFields. These columns describe the version, not the deal it froze, so they are
 * declared on DealVersion alone and the live deal table gets no twin.
 *
 * Not a deal_note either. The note recorded here is about the sign-off, and the deal's own
 * timeline is the conversation that produced it; mixing the two would put a reviewer's verdict on
 * the work in among the work.
 */
ALTER TABLE deal_version
    -- NULL until somebody looks at it: "not reviewed" is a third position, not UNASSURED.
    ADD COLUMN assurance_status     VARCHAR(16),
    ADD COLUMN assurance_note       TEXT,
    ADD COLUMN assurance_by_user_id BIGINT,
    ADD COLUMN assurance_at         TIMESTAMPTZ;

ALTER TABLE deal_version
    -- RESTRICT, matching fk_deal_version_verifier: the person who assured a sign-off must not
    -- silently detach from it when they leave the firm.
    ADD CONSTRAINT fk_deal_version_assurer FOREIGN KEY (assurance_by_user_id) REFERENCES app_user(id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_deal_version_assurance_status CHECK (
        assurance_status IS NULL OR assurance_status IN ('ASSURED', 'UNASSURED')),
    -- A mark names its note, who and when together, or none of them. Same reasoning as
    -- chk_deal_version_reopen (V41): half a record is worse than none. The 3-character floor
    -- matches chk_deal_note_body (V29) and NoteRequest.
    ADD CONSTRAINT chk_deal_version_assurance_record CHECK (
        (assurance_status IS NULL AND assurance_note IS NULL
            AND assurance_by_user_id IS NULL AND assurance_at IS NULL)
     OR (assurance_status IS NOT NULL AND length(btrim(assurance_note)) >= 3
            AND assurance_by_user_id IS NOT NULL AND assurance_at IS NOT NULL));
