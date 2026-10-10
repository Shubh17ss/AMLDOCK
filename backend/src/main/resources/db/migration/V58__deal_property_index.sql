-- Deal search matches the property address only (DealListQuery.appendSearch).
--
-- An address search finds matching properties through idx_property_address_trgm, then maps them
-- back to deals. With no index on deal.property_id, that mapping hashed every deal in the
-- caller's firm: 64 of 81 ms for 111 matches at 25k deals per firm. With this index it is one
-- B-tree lookup per match, 48-50 ms -> 12 ms, so the cost tracks the matches, not the firm's size
-- (perf/reports/2026-10-06-scale-500k.md, "big firms").
--
-- No backfill; builds in seconds at 500k deals. Plain CREATE INDEX for the same reason as V54.
CREATE INDEX IF NOT EXISTS idx_deal_property ON deal (property_id);

-- Client name is no longer searched anywhere, so its trigram index (V54) is only a write cost.
-- idx_deal_reference_trgm stays: the owners register still matches deal reference.
DROP INDEX IF EXISTS idx_client_display_name_trgm;
