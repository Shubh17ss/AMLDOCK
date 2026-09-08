/*
 * Two answers an individual gives that the schema was too narrow to hold.
 *
 * 1. TYPE BECOMES A SET.
 *
 * person_role (V34) held one capacity per individual, and PersonRole's javadoc called that "a
 * deliberate simplification, not an oversight": a person holding two capacities was to be recorded
 * under the one that mattered most, with the rest in the node's notes. It does not survive contact
 * with a family trust, where the same human is routinely settlor and trustee and appointer, and the
 * two capacities nobody recorded are the two a reviewer most wants named. Notes are not a field
 * anything can read, so the second answer was invisible to every register and every report.
 *
 * Stored as a delimited list in one column rather than a join table. ownership_node's columns are
 * declared once on the OwnershipNodeFields @MappedSuperclass and inherited by BOTH the live entity
 * and DealVersionNode, whose copyOf() is a BeanUtils.copyProperties — a scalar column comes across
 * for free, an @ElementCollection would need its own second join table and would not be copied at
 * all. So: one column, and PersonRoleSetConverter is the only thing that writes it.
 *
 * That converter is also why there is no replacement CHECK constraint. A vocabulary can be checked
 * when the column holds one value from it; it cannot when the column holds a list, short of a
 * regex nobody would trust. The constraint's job moves into Java, where the set is an EnumSet and
 * an unparseable token is impossible to store.
 *
 * 2. WHERE THE PERSON ACTUALLY LIVES.
 *
 * beneficial_owner has held country_of_residence since V39 and nothing more precise. A country is
 * enough to flag an overseas resident and nowhere near enough to match a proof of address against
 * what the client told us, which is the check the document is filed for. Free text, deliberately:
 * this is typed as the person gave it, with no address lookup behind it — an overseas address has
 * no NZ format to normalise to, and a suggestion the client did not make is not evidence.
 *
 * On beneficial_owner rather than ownership_node, following the split V34 set out and V39
 * followed: the node holds what THIS deal says about someone, the person record holds who they
 * are. Where someone lives is who they are.
 *
 * 3. THE PAIRED ALTERS.
 *
 * V41 built every deal_version_* table with CREATE TABLE x (LIKE y EXCLUDING ALL) — a one-time
 * clone with nothing keeping it in step afterwards. The Fields superclass is shared by both twins
 * and Hibernate runs ddl-auto: validate, so a column added to only one of them fails startup
 * rather than drifting quietly. This is the first migration since V41 to add a column, so every
 * ALTER below comes in a pair. EXCLUDING ALL left the clones without constraints, which is why
 * only the live table has one to drop.
 */

-- ---- Type: one capacity becomes a set of them ------------------------------

ALTER TABLE ownership_node
    ADD COLUMN person_roles VARCHAR(512);

UPDATE ownership_node
   SET person_roles = person_role
 WHERE person_role IS NOT NULL;

ALTER TABLE ownership_node
    DROP CONSTRAINT chk_ownership_node_person_role,
    DROP COLUMN person_role;

ALTER TABLE deal_version_node
    ADD COLUMN person_roles VARCHAR(512);

UPDATE deal_version_node
   SET person_roles = person_role
 WHERE person_role IS NOT NULL;

ALTER TABLE deal_version_node
    DROP COLUMN person_role;

-- ---- Where the person lives ------------------------------------------------

ALTER TABLE beneficial_owner
    ADD COLUMN physical_address TEXT;

ALTER TABLE deal_version_person
    ADD COLUMN physical_address TEXT;
