-- NZBN/ABN is unique within a country rather than across all of them: NZBNs and ABNs come from
-- different registers, so the same digits may belong to an NZ and an AU entity. Replaces V13's
-- global index. Existing rows already satisfy this, being unique globally.
DROP INDEX IF EXISTS uq_firm_nzbn;
CREATE UNIQUE INDEX uq_firm_country_nzbn ON real_estate_firm (country, lower(nzbn)) WHERE nzbn IS NOT NULL;
