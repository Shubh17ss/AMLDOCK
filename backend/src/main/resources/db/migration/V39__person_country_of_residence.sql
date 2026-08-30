/*
 * Where a beneficial owner lives.
 *
 * On beneficial_owner rather than ownership_node, following the split V34 set out: the node holds
 * what THIS deal says about someone, the person record holds who they are firm-wide. Where someone
 * resides is who they are — a person on two deals lives in one country — so it sits beside
 * occupation and source_of_funds and propagates to every deal they appear on.
 *
 * None of the country columns already in the schema answers this question. phone_country is a
 * dialling code, id_document_country is whoever issued a passport, jurisdiction_country is where an
 * entity is governed and is never set for an individual, and property.country is copied from the
 * reporting entity rather than supplied by the client.
 *
 * VARCHAR(2) ISO 3166-1 alpha-2, matching phone_country — and VARCHAR rather than CHAR for the same
 * reason V34 gave: CHAR's blank padding is a comparison trap nobody needs on a two-character code.
 *
 * Nullable with no default. The Overseas Residents register reads this column, and a row nobody has
 * opened must not read as an answer somebody gave — "not asked" and "lives here" are different
 * facts, and only one of them is safe to act on.
 */
ALTER TABLE beneficial_owner
    ADD COLUMN country_of_residence VARCHAR(2);
