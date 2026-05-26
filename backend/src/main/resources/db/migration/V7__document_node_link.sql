-- M8: documents can be attached to a specific ownership node (e.g. DL/passport for a person
-- node, trust deed for a trust node). Node-attached docs still carry deal_id so the existing
-- deal-scoped queries continue to surface them.

ALTER TABLE document
    ADD COLUMN ownership_node_id BIGINT;

ALTER TABLE document
    ADD CONSTRAINT fk_document_node
        FOREIGN KEY (ownership_node_id) REFERENCES ownership_node(id) ON DELETE CASCADE;

CREATE INDEX idx_document_node ON document(ownership_node_id);
