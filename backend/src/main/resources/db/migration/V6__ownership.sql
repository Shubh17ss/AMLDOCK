-- M6: nested ownership structure attached to each deal.
-- Adjacency list (parent/child) with a separate edge table so we can carry both
-- percentage (for shareholders / partners) and a role (for trustees / beneficiaries
-- where there is no percentage).

CREATE TABLE ownership_structure (
    id              BIGSERIAL PRIMARY KEY,
    deal_id         BIGINT NOT NULL UNIQUE,
    root_node_id    BIGINT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ownership_structure_deal FOREIGN KEY (deal_id) REFERENCES deal(id) ON DELETE CASCADE
);

CREATE TABLE ownership_node (
    id                       BIGSERIAL PRIMARY KEY,
    ownership_structure_id   BIGINT NOT NULL,
    node_type                VARCHAR(32) NOT NULL,
    display_name             VARCHAR(255) NOT NULL,

    -- Natural person fields
    date_of_birth            DATE,
    id_document_type         VARCHAR(32),
    id_document_number       VARCHAR(64),
    id_document_country      VARCHAR(3),

    -- NZ company fields
    nzbn                     VARCHAR(32),
    company_number           VARCHAR(64),
    incorporation_date       DATE,
    registered_office        TEXT,

    -- Trust fields
    trust_name               VARCHAR(255),
    trust_deed_document_id   BIGINT,
    settlor_name             VARCHAR(255),

    -- Future-proofing for LLM-extracted fields (M5/MVP-2)
    extra_json               JSONB,

    -- Denormalised verification status (source of truth lands in verification_check in M9)
    verification_status      VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',

    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ownership_node_structure FOREIGN KEY (ownership_structure_id)
        REFERENCES ownership_structure(id) ON DELETE CASCADE,
    CONSTRAINT fk_ownership_node_trust_deed FOREIGN KEY (trust_deed_document_id)
        REFERENCES document(id) ON DELETE SET NULL,
    CONSTRAINT chk_ownership_node_type CHECK (node_type IN
        ('NATURAL_PERSON','NZ_COMPANY','TRUST','PARTNERSHIP','OTHER')),
    CONSTRAINT chk_ownership_node_id_doc_type CHECK (id_document_type IS NULL OR id_document_type IN
        ('DRIVER_LICENCE','PASSPORT')),
    CONSTRAINT chk_ownership_node_verification CHECK (verification_status IN
        ('NOT_STARTED','IN_PROGRESS','VERIFIED','FAILED'))
);

CREATE INDEX idx_ownership_node_structure ON ownership_node(ownership_structure_id);

-- Late-bind root_node_id FK (chicken-and-egg: structure references node, node references structure).
ALTER TABLE ownership_structure
    ADD CONSTRAINT fk_ownership_structure_root
        FOREIGN KEY (root_node_id) REFERENCES ownership_node(id) ON DELETE SET NULL;

CREATE TABLE ownership_edge (
    id              BIGSERIAL PRIMARY KEY,
    parent_node_id  BIGINT NOT NULL,
    child_node_id   BIGINT NOT NULL,
    percentage      NUMERIC(5,2),
    role            VARCHAR(32),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ownership_edge_parent FOREIGN KEY (parent_node_id)
        REFERENCES ownership_node(id) ON DELETE CASCADE,
    CONSTRAINT fk_ownership_edge_child FOREIGN KEY (child_node_id)
        REFERENCES ownership_node(id) ON DELETE CASCADE,
    CONSTRAINT uq_ownership_edge UNIQUE (parent_node_id, child_node_id),
    CONSTRAINT chk_ownership_edge_self CHECK (parent_node_id <> child_node_id),
    CONSTRAINT chk_ownership_edge_percentage CHECK (percentage IS NULL
        OR (percentage >= 0 AND percentage <= 100)),
    CONSTRAINT chk_ownership_edge_role CHECK (role IS NULL OR role IN
        ('TRUSTEE','BENEFICIARY','SHAREHOLDER','PARTNER'))
);

CREATE INDEX idx_ownership_edge_parent ON ownership_edge(parent_node_id);
CREATE INDEX idx_ownership_edge_child  ON ownership_edge(child_node_id);
