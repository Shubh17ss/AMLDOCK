-- Enforce unique NZBN/ABN per firm (name is already UNIQUE from V2).
-- NZBN/ABN is optional, so the uniqueness is a partial index that ignores NULLs — multiple
-- firms may have no business number, but a non-empty one can't be shared.

-- Treat blank values as "not provided".
UPDATE real_estate_firm SET nzbn = NULL WHERE nzbn IS NOT NULL AND btrim(nzbn) = '';

-- Defensively null out any pre-existing duplicates (keep the earliest firm) so the unique
-- index can be created on existing dev data without failing.
UPDATE real_estate_firm r
   SET nzbn = NULL
 WHERE nzbn IS NOT NULL
   AND EXISTS (
        SELECT 1 FROM real_estate_firm r2
         WHERE r2.id < r.id
           AND lower(r2.nzbn) = lower(r.nzbn)
   );

CREATE UNIQUE INDEX uq_firm_nzbn ON real_estate_firm (lower(nzbn)) WHERE nzbn IS NOT NULL;
