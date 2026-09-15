/*
 * Two unrelated gaps, one migration.
 *
 * 1. WHAT SHARE OF THE PROPERTY A TOP-LEVEL OWNER HOLDS.
 *
 * Ownership percentages live on ownership_edge: "this child owns X% of its parent". An owner at the
 * top of the chain has no incoming edge — nothing owns it — so there has never been anywhere to
 * record the one figure a reviewer most wants from that row, which is how much of the PROPERTY it
 * holds. The tree's percentage chip is gated on the parent edge and the drawer's whole "Link from
 * parent" block is gated on the incoming edge, so a top-level node shows nothing and offers nothing.
 *
 * The column mirrors ownership_edge.percentage exactly — NUMERIC(5,2), nullable, same 0-100 CHECK
 * (V6) — because it is the same kind of answer measured the same way, and two percentage columns
 * that round differently would be a bug waiting to happen.
 *
 * It is cleared when the node gains an owner above it, enforced in OwnershipService.createEdge
 * rather than here: a node with a parent does not own the property directly, and a figure left
 * behind from when it did would be read as a current answer. Nothing to backfill — no top-level
 * node has ever had a value to carry over.
 *
 * Deliberately NO cross-row constraint. Siblings under one parent are not made to sum to 100, and
 * neither are the top-level owners: partial structures are the normal state of a deal under review,
 * and a register that refuses to record what the client actually said is worse than one that adds
 * up. The per-row 0-100 bound is the only rule, matching the edge.
 *
 * 2. WHICH AGENTS MAY REACH A DEAL.
 *
 * DealLifecycleService.assertCanRead confines AGENT and AGENT_PA to deals they created, while
 * ADMIN and SALES_MANAGER see the whole branch and compliance the whole firm. So there is no way at
 * all to let a second agent onto a colleague's deal — not a restriction anyone chose, just the
 * absence of a table to express the exception.
 *
 * This is NOT a revival of what V29 deleted. That migration dropped deal.assigned_compliance_user_id
 * because a deal is not tied to one REVIEWER — any compliance officer of the firm may act on any
 * deal in it, and a single-assignee column contradicted that. This table is the opposite axis: it
 * only ever WIDENS which agents may reach a deal, and touches nobody's firm- or branch-level reach.
 * Access is additive, so an empty table means exactly what it means today and there is no backfill.
 *
 * Not copied into a deal_version_* twin. Who may open a deal is not part of what the deal said when
 * it was signed off — it changes for operational reasons long after, and freezing it would make a
 * version claim a fact about staffing it was never asked to record. The audit trail carries the
 * grants.
 *
 * 3. THE PAIRED ALTER.
 *
 * V41 built every deal_version_* table with CREATE TABLE x (LIKE y EXCLUDING ALL) — a one-time
 * clone with nothing keeping it in step. OwnershipNodeFields is a @MappedSuperclass shared by the
 * live entity and DealVersionNode, and Hibernate runs ddl-auto: validate, so a column added to one
 * twin and not the other fails startup. EXCLUDING ALL left the clone without constraints, which is
 * why only the live table gets the CHECK.
 */

-- ---- 1. A top-level owner's share of the property ---------------------------

ALTER TABLE ownership_node
    ADD COLUMN property_percentage NUMERIC(5,2),
    ADD CONSTRAINT chk_ownership_node_property_percentage
        CHECK (property_percentage IS NULL
               OR (property_percentage >= 0 AND property_percentage <= 100));

ALTER TABLE deal_version_node
    ADD COLUMN property_percentage NUMERIC(5,2);

-- ---- 2. Agents granted access to a deal they did not create -----------------

CREATE TABLE deal_user (
    id               BIGSERIAL PRIMARY KEY,
    deal_id          BIGINT NOT NULL,
    user_id          BIGINT NOT NULL,
    -- Who let them in. The audit trail records the act; this keeps the answer on the row itself,
    -- where anyone reading the grant can see it without going looking.
    added_by_user_id BIGINT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_deal_user_deal FOREIGN KEY (deal_id) REFERENCES deal(id) ON DELETE CASCADE,
    CONSTRAINT fk_deal_user_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    -- A grant is a fact, not a quantity: granting twice is the same as granting once.
    CONSTRAINT uq_deal_user UNIQUE (deal_id, user_id)
);

-- Both directions are hot: the drawer lists a deal's users, and every deal list an agent loads
-- asks which deals they have been let onto.
CREATE INDEX idx_deal_user_deal ON deal_user(deal_id);
CREATE INDEX idx_deal_user_user ON deal_user(user_id);
