-- M3.5: shift property addresses to cascading NZ structure.
-- city -> district (because in NZ a district / territorial-authority sits below the region
-- and contains suburbs). Add country (NZ-locked at MVP-1) and region.

ALTER TABLE property
    ADD COLUMN country VARCHAR(3) NOT NULL DEFAULT 'NZ';

ALTER TABLE property
    ADD COLUMN region VARCHAR(128);

ALTER TABLE property
    RENAME COLUMN city TO district;
