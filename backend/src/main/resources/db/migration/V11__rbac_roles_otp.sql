-- RBAC role redesign + OTP authentication.
--
-- New 7-role hierarchy (replaces BROKER / COMPLIANCE / MANAGER / FIRM_USER):
--   ROOT                                    → firm NULL, branch NULL  (platform super-admin, password + OTP)
--   AML_COMPLIANCE_OFFICER / SENIOR_MANAGER → firm NOT NULL, branch NULL  (firm level, email + OTP)
--   SALES_MANAGER / AGENT / AGENT_PA / ADMIN → firm NOT NULL, branch NOT NULL  (branch level, email + OTP)
--
-- Dev data is reset & reseeded, so no role-value backfill is performed here. If any legacy rows
-- remain they must be migrated/removed before this runs, as the new CHECK rejects the old names.

-- 1. Replace the old role-name whitelist (V1) and the per-role linkage rules (V8).
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS chk_app_user_role;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS chk_app_user_role_links;

-- 1a. Reset & reseed dev data: the new role CHECK is incompatible with the old role values
-- (BROKER / COMPLIANCE / MANAGER / FIRM_USER). Because dev data is disposable, clear the user
-- graph so the new constraints apply to a clean slate. This fires ONLY when a legacy role value
-- is present, so on a fresh database (empty app_user) it is a no-op. TRUNCATE ... CASCADE also
-- clears everything that references app_user (deals, documents, audit, refresh tokens). The
-- DataSeeder reseeds the ROOT account on next startup.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM app_user
         WHERE role NOT IN ('ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER',
                            'SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN')
    ) THEN
        TRUNCATE TABLE app_user RESTART IDENTITY CASCADE;
        RAISE NOTICE 'V11: cleared legacy user data (reset & reseed) before applying new role constraints.';
    END IF;
END $$;

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_role CHECK (role IN (
        'ROOT',
        'AML_COMPLIANCE_OFFICER',
        'SENIOR_MANAGER',
        'SALES_MANAGER',
        'AGENT',
        'AGENT_PA',
        'ADMIN'
    ));

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_role_links CHECK (
        (role = 'ROOT'
            AND real_estate_firm_id IS NULL
            AND firm_branch_id IS NULL)
     OR (role IN ('AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER')
            AND real_estate_firm_id IS NOT NULL
            AND firm_branch_id IS NULL)
     OR (role IN ('SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN')
            AND real_estate_firm_id IS NOT NULL
            AND firm_branch_id IS NOT NULL)
    );

-- 2. Passwords are now optional — only ROOT has one (every other role signs in with email + OTP).
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;

-- 3. One-time passcodes for email-OTP login (and the admin password+OTP second factor).
CREATE TABLE otp_code (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    code_hash   VARCHAR(255) NOT NULL,
    purpose     VARCHAR(32)  NOT NULL,   -- LOGIN | ADMIN_LOGIN
    attempts    INT          NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ  NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_otp_code_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_otp_code_user ON otp_code(user_id);
CREATE INDEX idx_otp_code_expires ON otp_code(expires_at);
