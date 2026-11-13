-- A deal can now carry two structures: the vendor's, which it has always had, and the purchaser's,
-- recorded once the deal has closed as sold.
--
-- Same tables for both: owners, links, documents and verifications all hang off the structure, so
-- the purchaser gets every one of them without a parallel copy. Only the vendor's structure feeds
-- the deal's risk, readiness and versions; the purchaser is recorded after the sign-off, not under it.
--
-- Every existing row is the vendor's, which is what the default says.
ALTER TABLE ownership_structure
    ADD COLUMN side VARCHAR(16) NOT NULL DEFAULT 'VENDOR',
    ADD CONSTRAINT chk_ownership_structure_side CHECK (side IN ('VENDOR', 'PURCHASER'));

-- One structure per side, rather than one per deal (V6: deal_id NOT NULL UNIQUE).
ALTER TABLE ownership_structure DROP CONSTRAINT ownership_structure_deal_id_key;
ALTER TABLE ownership_structure
    ADD CONSTRAINT uq_ownership_structure_deal_side UNIQUE (deal_id, side);
