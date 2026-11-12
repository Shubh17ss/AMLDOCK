-- A random public identifier for every reporting entity and branch, used in URLs and the
-- /firms and /branches endpoints in place of the sequential id — the same idea as V63 for deals.
-- The numeric id stays the primary key, what every foreign key points at, and what the other
-- APIs filter by.
--
-- 12 digits, the first never 0 so the id keeps its length wherever it is written as a number:
-- about 9 × 10^11 values. New rows get theirs from the application (FirmPublicIds); this fills in
-- the existing ones.
ALTER TABLE real_estate_firm ADD COLUMN public_id VARCHAR(12);
ALTER TABLE firm_branch ADD COLUMN public_id VARCHAR(12);

UPDATE real_estate_firm f
   SET public_id = (
       SELECT string_agg(
                  CASE WHEN g = 1
                       THEN substr('123456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 9, 1)
                       ELSE substr('0123456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 10, 1)
                  END, '' ORDER BY g)
         FROM generate_series(1, 12) AS g
        -- Correlated on f.id so each row draws its own digits rather than sharing one result.
        WHERE f.id IS NOT NULL
   );

UPDATE firm_branch b
   SET public_id = (
       SELECT string_agg(
                  CASE WHEN g = 1
                       THEN substr('123456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 9, 1)
                       ELSE substr('0123456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 10, 1)
                  END, '' ORDER BY g)
         FROM generate_series(1, 12) AS g
        WHERE b.id IS NOT NULL
   );

ALTER TABLE real_estate_firm ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE firm_branch ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX uq_real_estate_firm_public_id ON real_estate_firm (public_id);
CREATE UNIQUE INDEX uq_firm_branch_public_id ON firm_branch (public_id);
