-- Owner search now matches the owner's name only (IndividualQuery), and deal search the property
-- address only (V58). Nothing searches deal reference any more, so its trigram index (V54) is
-- only a write cost on every deal insert and update.
DROP INDEX IF EXISTS idx_deal_reference_trgm;
