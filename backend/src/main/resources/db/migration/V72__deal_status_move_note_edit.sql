/*
 * TRANSACTION MONITORING: A MOVE'S NOTE CAN BE CORRECTED AFTER THE FACT.
 *
 * deal_status_move (V52) was append-only. It still is for every figure - the kind, the times, the
 * version, the valuation and the sale - but a reviewer may now add a note to a move recorded
 * without one, or correct the one it was made with.
 *
 * Who last changed the note, and when, sits on the row so the screen can say the note is not the
 * one the move was made with. The text it replaced goes to audit_log (DEAL_MOVE_NOTE_EDITED).
 */
ALTER TABLE deal_status_move
    ADD COLUMN note_edited_at TIMESTAMPTZ,
    -- RESTRICT, as for actor_user_id: a byline must not silently detach when its author leaves.
    ADD COLUMN note_edited_by BIGINT REFERENCES app_user(id) ON DELETE RESTRICT;
