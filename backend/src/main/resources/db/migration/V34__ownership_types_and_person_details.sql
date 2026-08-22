-- V34: the owner types a real ownership structure is made of, and what we hold about a person.
--
-- Until now the structure knew five node types and, for an individual, only what ID extraction
-- writes: a name, a date of birth, the kind of card it came from. There was no way to record who
-- someone actually is to the deal — their capacity, how to reach them, what they do, where their
-- money came from.
--
-- Two homes for those fields, and the split is deliberate:
--   ownership_node     — what THIS deal says about them. Capacity, notes, reference.
--   beneficial_owner   — who they are, firm-wide. Contact details, occupation, source of funds.
-- A person on two deals is one person; a person's capacity on two deals is two answers.

/* ---------- node type vocabulary ---------- */

ALTER TABLE ownership_node DROP CONSTRAINT chk_ownership_node_type;

-- NZ_COMPANY says the same thing as PRIVATE_COMPANY while asserting a jurisdiction the column
-- has no business asserting. No rows carry it, so this is a vocabulary change, not a migration.
UPDATE ownership_node SET node_type = 'PRIVATE_COMPANY' WHERE node_type = 'NZ_COMPANY';

ALTER TABLE ownership_node
    ADD CONSTRAINT chk_ownership_node_type CHECK (node_type IN (
        -- Always a leaf: a natural person owns things, nothing owns them. Enforced in
        -- OwnershipService, which can see both ends of an edge; a CHECK cannot.
        'INDIVIDUAL',

        'PRIVATE_COMPANY',
        'LISTED_COMPANY',
        'TRUSTEE_COMPANY',
        'TRUST',
        'PARTNERSHIP',
        'LIMITED_PARTNERSHIP',
        'INCORPORATED_SOCIETY',
        'CHARITY',
        'GOVERNMENT_AGENCY',
        'DECEASED_ESTATE',

        -- Kept. An escape hatch for the structure nobody anticipated is worth more than the
        -- tidiness of a closed list, and an officer forced to mislabel is worse than "Other".
        'OTHER'
    ));

/* ---------- what this deal says about a person ---------- */

ALTER TABLE ownership_node
    -- The capacity in which they appear on THIS deal. A trustee here can be a guarantor
    -- elsewhere, which is exactly why this is not on beneficial_owner.
    ADD COLUMN person_role VARCHAR(32),
    -- Free text. The UI prompts for a link to a previous deal, but a reference to a file note or
    -- an external system is just as legitimate, so nothing here parses it.
    ADD COLUMN reference VARCHAR(255),
    ADD CONSTRAINT chk_ownership_node_person_role CHECK (person_role IS NULL OR person_role IN (
        'OWNER_25_PLUS',
        'TRUSTEE',
        'SETTLOR',
        'EFFECTIVE_CONTROLLER',
        'ACTING_ON_BEHALF_OF_CLIENT',
        'APPOINTER',
        'EXECUTOR',
        'PARTNER',
        'PROTECTOR',
        'GUARANTOR'
    ));

/* ---------- who the person is, firm-wide ---------- */

ALTER TABLE beneficial_owner
    -- 320 = 64 local part + @ + 255 domain, the RFC 5321 maximum. Unvalidated beyond length:
    -- a CDD record holds what the client gave, and a rejected address is a lost fact.
    ADD COLUMN email VARCHAR(320),
    -- ISO country plus national number rather than one E.164 string. The flag needs the country,
    -- and +1 cannot tell the US from Canada.
    --
    -- VARCHAR rather than CHAR: every other country column in this schema is one
    -- (ownership_node.id_document_country, property.country), and CHAR's blank padding is a
    -- comparison trap nobody needs on a two-character code.
    ADD COLUMN phone_country VARCHAR(2),
    ADD COLUMN phone_number VARCHAR(32),
    ADD COLUMN occupation VARCHAR(255),
    -- One field, not two. "Source of wealth" and "source of funds" are asked as one question and
    -- answered in one breath; splitting them invites the same sentence typed twice.
    ADD COLUMN source_of_funds TEXT;

/* ---------- every individual gets a person record ---------- */

-- The shared fields above live on beneficial_owner, so an INDIVIDUAL node without one has
-- nowhere to put an email address. Extraction-created nodes always have one; a node added by
-- hand before this migration does not.
--
-- No rows match today. The statement is here so the invariant holds on any environment, and so
-- the code in OwnershipService.createNode is not the only thing standing between a hand-added
-- individual and a form that silently discards what is typed into it.
-- Row by row rather than a set-based INSERT ... RETURNING: RETURNING can only hand back columns
-- of the row it inserted, and the node id is not one of them. Rejoining afterwards would have to
-- match on the display name, which is not unique. A loop over a set that is empty in practice
-- costs nothing and is exactly right.
DO $$
DECLARE
    r         RECORD;
    new_owner BIGINT;
BEGIN
    FOR r IN
        SELECT n.id AS node_id, n.display_name, n.date_of_birth,
               d.id AS deal_id, b.real_estate_firm_id AS firm_id
          FROM ownership_node n
          JOIN ownership_structure s ON s.id = n.ownership_structure_id
          JOIN deal d                ON d.id = s.deal_id
          JOIN firm_branch b         ON b.id = d.firm_branch_id
         WHERE n.node_type = 'INDIVIDUAL'
           AND n.beneficial_owner_id IS NULL
    LOOP
        INSERT INTO beneficial_owner (real_estate_firm_id, full_name, date_of_birth, review_status)
        VALUES (r.firm_id, r.display_name, r.date_of_birth, 'UNREVIEWED')
        RETURNING id INTO new_owner;

        UPDATE ownership_node SET beneficial_owner_id = new_owner WHERE id = r.node_id;

        INSERT INTO deal_beneficial_owner (deal_id, beneficial_owner_id)
        VALUES (r.deal_id, new_owner)
        ON CONFLICT (deal_id, beneficial_owner_id) DO NOTHING;
    END LOOP;
END $$;
