-- Trigram (pg_trgm) GIN indexes for the list searches (ILIKE '%q%') in DealListQuery,
-- IndividualQuery and AssuranceQuery.
--
-- A contains-match with a leading wildcard cannot use a B-tree index, so every search used to read
-- the whole table. A trigram index lists, for every three-character chunk, the rows containing it;
-- a search intersects the lists for its chunks and checks only those candidates.
--
-- Measured on 50k deals, 1 vCPU (perf/reports/2026-10-06-gin-indexes.md):
--   owner search 148 ms -> 50 ms; deals search 111 ms -> 37 ms; stress test clean to 139 req/s
--   (p99 ~65 ms) where it broke at ~110 req/s without them. Write cost +0.03-0.05 ms per
--   insert/update of an indexed column, unmeasurable at request level; ~12 MB of index at 50k deals.
--
-- These only help because the queries match each field in its own sub-select. A single OR across
-- the joined tables cannot use them (measured: 251 ms with the indexes present).
--
-- Plain CREATE INDEX, not CONCURRENTLY: it runs inside Flyway's transaction and at current table
-- sizes builds in seconds. On a much larger production table, move a rebuild to a separate
-- non-transactional migration with CREATE INDEX CONCURRENTLY to avoid blocking writes.
--
-- pg_trgm is a trusted extension (PostgreSQL 13+), so the database owner can create it; it is also
-- supported on Amazon RDS for PostgreSQL. Same index names as perf/sql/gin-indexes.sql, which used
-- IF NOT EXISTS, so a perf database that already ran that script migrates cleanly.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Owner name: the individuals registers' search and the owner picker.
CREATE INDEX IF NOT EXISTS idx_ownership_node_name_trgm
    ON ownership_node USING gin (display_name gin_trgm_ops);

-- Deal reference: deals list, assurance and individuals searches.
CREATE INDEX IF NOT EXISTS idx_deal_reference_trgm
    ON deal USING gin (reference gin_trgm_ops);

-- Client name: deals list and assurance searches.
CREATE INDEX IF NOT EXISTS idx_client_display_name_trgm
    ON client USING gin (display_name gin_trgm_ops);

-- Property address, as the exact expression the queries match on
-- (nz.amldock.common.web.PageRequests.ADDRESS_SEARCH_SQL). Plain concatenation, because an index
-- expression must be IMMUTABLE and concat_ws is only STABLE. Change one, change both, or the index
-- silently stops being used.
CREATE INDEX IF NOT EXISTS idx_property_address_trgm
    ON property USING gin ((coalesce(address_line1, '') || ', ' || coalesce(suburb, '') || ', '
                            || coalesce(district, '') || ', ' || coalesce(region, '')) gin_trgm_ops);
