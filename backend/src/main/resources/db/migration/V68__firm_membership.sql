-- Reporting-entity membership.
--
-- Until now an account belonged to exactly one reporting entity, in exactly one role, through three
-- columns on app_user. A compliance officer or senior manager can now serve several entities with
-- one email address, so the link moves to its own table: one row per account per entity, each with
-- its own role and branch, each switched on and off on its own.
--
-- The rule on how many may be active at once — several only if every active one is firm-level
-- (AML_COMPLIANCE_OFFICER / SENIOR_MANAGER), otherwise at most one — spans rows, so it is enforced
-- by MembershipService under a lock on the user row rather than here.
--
-- app_user keeps role / real_estate_firm_id / firm_branch_id as the account's *home* membership:
-- the one a new sign-in starts in, which is the last one the user switched to. While an account has
-- an active membership the home is always one of them (MembershipService keeps it so), which is
-- why every existing reader of those columns stays right for the common one-entity account, and
-- why chk_app_user_role_links still holds unchanged. ROOT and AUDIT have no memberships and are
-- described by app_user alone, as before.
--
-- app_user.is_active becomes, for everyone but ROOT and AUDIT, "has at least one active
-- membership" — kept in step by MembershipService, so sign-in and JwtAuthenticationFilter go on
-- checking the one column they always have.

CREATE TABLE firm_membership (
    id                  BIGSERIAL    PRIMARY KEY,
    app_user_id         BIGINT       NOT NULL,
    real_estate_firm_id BIGINT       NOT NULL,
    firm_branch_id      BIGINT       NULL,
    role                VARCHAR(32)  NOT NULL,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    deactivated_at      TIMESTAMPTZ  NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_firm_membership_user   FOREIGN KEY (app_user_id)
        REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_firm_membership_firm   FOREIGN KEY (real_estate_firm_id)
        REFERENCES real_estate_firm(id) ON DELETE RESTRICT,
    CONSTRAINT fk_firm_membership_branch FOREIGN KEY (firm_branch_id)
        REFERENCES firm_branch(id) ON DELETE RESTRICT,
    -- One row per account per entity. Leaving and rejoining an entity reactivates the old row,
    -- so the history of who was where is a single row's, not a pile of them.
    CONSTRAINT uq_firm_membership_user_firm UNIQUE (app_user_id, real_estate_firm_id),
    -- The entity-scoped roles and their linkage, as chk_app_user_role_links (V27) has them.
    CONSTRAINT chk_firm_membership_role_links CHECK (
        (role IN ('AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'FINANCE')
            AND firm_branch_id IS NULL)
     OR (role IN ('SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN')
            AND firm_branch_id IS NOT NULL)
    )
);

CREATE INDEX idx_firm_membership_firm   ON firm_membership(real_estate_firm_id);
CREATE INDEX idx_firm_membership_branch ON firm_membership(firm_branch_id);

-- Every existing entity-scoped account becomes its own single membership, active as it was.
INSERT INTO firm_membership
       (app_user_id, real_estate_firm_id, firm_branch_id, role, is_active, deactivated_at,
        created_at, updated_at)
SELECT id, real_estate_firm_id, firm_branch_id, role, is_active,
       CASE WHEN is_active THEN NULL ELSE updated_at END,
       created_at, updated_at
  FROM app_user
 WHERE role NOT IN ('ROOT', 'AUDIT');

-- The session a refresh token renews is a session in one entity. Without this, renewing would
-- re-read the account's home membership, and a switch on one device would move every other
-- device's session into that entity on its next refresh. NULL for ROOT and AUDIT, and for tokens
-- issued before this migration — those renew into the home membership, which is what they held.
ALTER TABLE refresh_token ADD COLUMN membership_id BIGINT NULL;
ALTER TABLE refresh_token
    ADD CONSTRAINT fk_refresh_token_membership FOREIGN KEY (membership_id)
        REFERENCES firm_membership(id) ON DELETE CASCADE;

-- The address is now how an existing account is found and attached to another entity, and the
-- application has always compared it case-insensitively. V1's UNIQUE is case-sensitive; this
-- makes the database agree with the application. Emails are lower-cased on every write path,
-- so no existing rows collide.
CREATE UNIQUE INDEX uq_app_user_email_lower ON app_user (lower(email));
