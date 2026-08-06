-- Two specialist roles outside the line of management (see nz.amldock.user.Role):
--   AUDIT   → reads every section of every reporting entity, writes nothing. Platform-wide, so it
--             takes ROOT's linkage shape: no firm, no branch.
--   FINANCE → the International Fund Transaction Register and Management Reports only. Scoped to
--             one reporting entity, so it takes the firm-level shape: firm, no branch.
--
-- No data migration: no user holds either role yet.
--
-- AUDIT's read-only guarantee is not expressed here. It lives in AuditReadOnlyFilter, which
-- rejects every non-GET request to /api/** for that role — one rule rather than a promise spread
-- across every endpoint.

ALTER TABLE app_user DROP CONSTRAINT chk_app_user_role;
ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_role CHECK (role IN (
        'ROOT',
        'AML_COMPLIANCE_OFFICER',
        'SENIOR_MANAGER',
        'SALES_MANAGER',
        'AGENT',
        'AGENT_PA',
        'ADMIN',
        'AUDIT',
        'FINANCE'
    ));

ALTER TABLE app_user DROP CONSTRAINT chk_app_user_role_links;
ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_role_links CHECK (
        (role IN ('ROOT', 'AUDIT')
            AND real_estate_firm_id IS NULL
            AND firm_branch_id IS NULL)
     OR (role IN ('AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'FINANCE')
            AND real_estate_firm_id IS NOT NULL
            AND firm_branch_id IS NULL)
     OR (role IN ('SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN')
            AND real_estate_firm_id IS NOT NULL
            AND firm_branch_id IS NOT NULL)
    );
