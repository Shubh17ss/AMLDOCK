-- A random public identifier for every deal, used in URLs, the API and email links in place of the
-- sequential id. The numeric id stays the primary key and what every foreign key points at; this
-- is only how a deal is named outside the database.
--
-- 12 characters from a 31-letter alphabet (lowercase letters and digits without the look-alikes
-- 0 o 1 l i): about 59 bits, generated from gen_random_uuid's cryptographic randomness. New deals
-- get theirs from the application (PublicIds); this fills in the existing ones.
ALTER TABLE deal ADD COLUMN public_id VARCHAR(12);

UPDATE deal d
   SET public_id = (
       SELECT string_agg(
                  substr('abcdefghjkmnpqrstuvwxyz23456789',
                         1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1), '')
         FROM generate_series(1, 12)
        -- Correlated on d.id so each deal draws its own characters rather than sharing one result.
        WHERE d.id IS NOT NULL
   );

ALTER TABLE deal ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX uq_deal_public_id ON deal (public_id);
