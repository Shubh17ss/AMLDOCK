-- The Overseas Residents Register covers every kind of owner, not only people.
--
-- An entity has no residence, but it has the country it is incorporated or registered in
-- (jurisdiction_country, V37). That is the same question asked of a company: is this owner outside
-- the reporting entity's own country? So the node's residence_country now holds whichever country
-- decides it - the person's residence for an individual, the jurisdiction for everything else - and
-- is_overseas keeps its V57 formula over it. The firm-country trigger, the deal and branch move
-- triggers and the register's partial index all work on those two columns, so they need nothing.
--
-- Decided by node_type rather than by whether a person is linked: an individual whose person record
-- has gone (beneficial_owner_id is ON DELETE SET NULL) is still a person with no residence on file,
-- not an entity to be judged by a jurisdiction it was never asked for.
CREATE OR REPLACE FUNCTION ownership_node_set_firm() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_firm_country VARCHAR;
BEGIN
  SELECT fb.real_estate_firm_id, f.country INTO NEW.real_estate_firm_id, v_firm_country
    FROM ownership_structure s
    JOIN deal d ON d.id = s.deal_id
    JOIN firm_branch fb ON fb.id = d.firm_branch_id
    JOIN real_estate_firm f ON f.id = fb.real_estate_firm_id
   WHERE s.id = NEW.ownership_structure_id;
  IF NEW.node_type = 'INDIVIDUAL' THEN
    NEW.residence_country := (SELECT bo.country_of_residence FROM beneficial_owner bo
                               WHERE bo.id = NEW.beneficial_owner_id);
  ELSE
    NEW.residence_country := NEW.jurisdiction_country;
  END IF;
  NEW.is_overseas := coalesce(NEW.residence_country IS NOT NULL AND NEW.residence_country <> v_firm_country, false);
  RETURN NEW;
END $$;

-- Now also on the jurisdiction, and on the type: a company retyped as an individual stops being
-- judged by its jurisdiction, and the reverse.
DROP TRIGGER IF EXISTS trg_ownership_node_set_firm ON ownership_node;
CREATE TRIGGER trg_ownership_node_set_firm
  BEFORE INSERT OR UPDATE OF ownership_structure_id, beneficial_owner_id, real_estate_firm_id,
                             jurisdiction_country, node_type ON ownership_node
  FOR EACH ROW EXECUTE FUNCTION ownership_node_set_firm();

-- Existing entities: their deciding country, and the flag against their firm's country.
UPDATE ownership_node n
   SET residence_country = n.jurisdiction_country,
       is_overseas = coalesce(n.jurisdiction_country IS NOT NULL AND n.jurisdiction_country <> f.country, false)
  FROM real_estate_firm f
 WHERE f.id = n.real_estate_firm_id
   AND n.node_type <> 'INDIVIDUAL';
