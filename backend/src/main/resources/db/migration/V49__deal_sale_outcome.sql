/*
 * WHAT THE DEAL FINISHED AS.
 *
 * Closing a deal has been a one-click move with no body since the lifecycle was built: the system
 * recorded that a file finished, but never what it finished as. Whether the property actually
 * sold, and for how much, is the fact a transaction-monitoring obligation rests on, and it was
 * nowhere in the data.
 *
 * NOT transaction_value. That column already exists on this table and means something else: the
 * broker's single estimated deal value from before V28, superseded by the valuation range but
 * still read as a fallback for old deals on the deal cards and in every dashboard total
 * (valuation_max ?? transaction_value). Writing a sale price into it would retroactively rewrite
 * those estimates and mix actuals into totals built from estimates. sale_price is its own column
 * so the two can never be confused - the form still labels it "Transaction value", because that
 * is what the people filling it in call it.
 *
 * NUMERIC(15,2) matches valuation_min / valuation_max on the same row. A sale price is the same
 * kind of number as the estimate it is compared against, and a different precision between them
 * would make that comparison quietly lossy.
 *
 * deal_sale_unit exists because a development is not sold once. A subdivision or an apartment
 * block changes hands as flats, each with its own name and its own price, and a single figure
 * would either be a sum nobody can break down or the first unit standing in for all of them.
 * Rows are replaced wholesale each time the deal is closed - a close is one whole-form
 * submission, not an incremental edit, and re-closing is how the answers get corrected.
 *
 * THE PAIRED ALTER. DealFields is a @MappedSuperclass shared by Deal and DealVersion, and
 * Hibernate runs ddl-auto: validate, so every column here has to land on both tables or the
 * application will not start. See the same note in V44 through V48.
 *
 * No deal_version_sale_unit twin, though. A version is written only on ENTERING verified, and a
 * sale is recorded on the way out of it, so a snapshot can never hold one. (DealVersionService
 * gains a guard in this same change so that reopening a closed deal does not write a second
 * snapshot of unchanged content on the way back through VERIFIED.) The two scalar columns still
 * have to exist on deal_version for validate to pass; they simply stay null there.
 *
 * The CHECK constraints live on the live table only. deal_version was cloned with EXCLUDING ALL
 * in V41 and deliberately carries none - a frozen version is written once by the server.
 */

ALTER TABLE deal
    ADD COLUMN property_sold BOOLEAN,
    ADD COLUMN sale_price    NUMERIC(15,2),
    ADD CONSTRAINT chk_deal_sale_price CHECK (sale_price IS NULL OR sale_price >= 0);

ALTER TABLE deal_version
    ADD COLUMN property_sold BOOLEAN,
    ADD COLUMN sale_price    NUMERIC(15,2);

CREATE TABLE deal_sale_unit (
    id         BIGSERIAL PRIMARY KEY,
    deal_id    BIGINT       NOT NULL,
    unit_name  VARCHAR(160) NOT NULL,
    sale_price NUMERIC(15,2) NOT NULL,
    -- The order the reviewer entered them in. A unit list is read as a list, and re-ordering it
    -- on every read because the ids happen to sort that way is luck, not a guarantee.
    sort_order INT          NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_deal_sale_unit_deal FOREIGN KEY (deal_id)
        REFERENCES deal(id) ON DELETE CASCADE,
    CONSTRAINT chk_deal_sale_unit_price CHECK (sale_price >= 0)
);

CREATE INDEX idx_deal_sale_unit_deal ON deal_sale_unit(deal_id);
