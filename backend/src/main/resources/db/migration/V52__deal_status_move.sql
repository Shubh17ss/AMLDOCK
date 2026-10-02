/*
 * TRANSACTION MONITORING: EVERY MOVE BETWEEN VERIFIED AND CLOSED, AS IT HAPPENED.
 *
 * Closing records what a deal finished as (V49), but only the latest answer: re-closing overwrites
 * deal.sale_price and replaces deal_sale_unit wholesale, a close writes no timeline entry, and
 * neither close nor unclose writes a version. So "what did this deal close at the first time,
 * against what valuation, and why was it reopened" had no answer once it moved again.
 *
 * One append-only row per move, with its figures copied at that moment so a later re-close cannot
 * rewrite them:
 *
 *   CLOSE    VERIFIED -> CLOSED    the sale outcome and total, the valuation it is judged against
 *   UNCLOSE  CLOSED -> VERIFIED    the reason it was reopened
 *
 * from_at is when the deal entered the state it is leaving - the verification (or the unclose
 * before it) for a CLOSE, the close for an UNCLOSE - so each row reads "Verified at X -> Closed at
 * Y" without a second lookup. version_no is the version the deal stood on, which is what the
 * screen opens when either label is clicked.
 *
 * sale_total is the sale price, or the sum of a development's units: the one figure the variance
 * rule compares with the valuation. The unit breakdown of the current close stays in
 * deal_sale_unit.
 *
 * Nothing to backfill: there are no deals at the time of writing.
 */
CREATE TABLE deal_status_move (
    id            BIGSERIAL PRIMARY KEY,
    deal_id       BIGINT      NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    kind          VARCHAR(16) NOT NULL,
    from_at       TIMESTAMPTZ,
    occurred_at   TIMESTAMPTZ NOT NULL,
    -- RESTRICT, as for every other byline: the person who closed a deal must not silently detach
    -- from the record when they leave the firm.
    actor_user_id BIGINT REFERENCES app_user(id) ON DELETE RESTRICT,
    version_no    INT,
    valuation_min NUMERIC(15,2),
    valuation_max NUMERIC(15,2),
    property_sold BOOLEAN,
    sale_total    NUMERIC(15,2),
    note          TEXT,
    CONSTRAINT chk_deal_status_move_kind CHECK (kind IN ('CLOSE', 'UNCLOSE')),
    -- An unclose undoes a sale outcome rather than recording one.
    CONSTRAINT chk_deal_status_move_unclose CHECK (
        kind = 'CLOSE' OR (property_sold IS NULL AND sale_total IS NULL))
);

CREATE INDEX idx_deal_status_move_deal ON deal_status_move(deal_id, occurred_at DESC);
