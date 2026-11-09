-- Which owner nodes stand for the same person or entity across deals.
--
-- Picking someone "already on file" copies them onto the new deal rather than linking; this key
-- is the one thing the copy carries over, so the Verification tab can show the verifications
-- granted to them elsewhere. Every existing node is its own identity: nothing recorded which node
-- an earlier copy came from, and guessing by name would join people who merely share one.
ALTER TABLE ownership_node
    ADD COLUMN identity_key UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX idx_ownership_node_firm_identity ON ownership_node (real_estate_firm_id, identity_key);
