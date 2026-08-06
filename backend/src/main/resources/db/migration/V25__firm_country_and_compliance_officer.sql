-- A reporting entity's primary contact is its AML compliance officer, not a senior manager: that
-- is the role that actually owns the firm's obligations. The contact columns are renamed to match
-- and firm onboarding now provisions an AML_COMPLIANCE_OFFICER login (see FirmService).
--
-- Entities also gain a country. `nzbn` was already documented as "NZBN (NZ) or ABN (AU)", so the
-- platform was implicitly two-country with nothing recording which.

ALTER TABLE real_estate_firm RENAME COLUMN senior_manager_name           TO compliance_officer_name;
ALTER TABLE real_estate_firm RENAME COLUMN senior_manager_email          TO compliance_officer_email;
ALTER TABLE real_estate_firm RENAME COLUMN senior_manager_contact_number TO compliance_officer_contact_number;

-- Every entity that exists today is a New Zealand one. The default backfills them, then goes away
-- so the application is the only thing that decides a new firm's country.
ALTER TABLE real_estate_firm ADD COLUMN country VARCHAR(2) NOT NULL DEFAULT 'NZ';
ALTER TABLE real_estate_firm ALTER COLUMN country DROP DEFAULT;
ALTER TABLE real_estate_firm ADD CONSTRAINT chk_ref_country CHECK (country IN ('NZ', 'AU'));

-- Bring the already-onboarded contacts across to the role the screen now names.
--
-- Matched on the firm's own contact email so this can only touch logins that firm onboarding
-- created; a senior manager somebody added by hand later keeps their role.
--
-- Constraint-safe: chk_app_user_role (V11) permits both values, and chk_app_user_role_links treats
-- AML_COMPLIANCE_OFFICER and SENIOR_MANAGER identically — firm not null, branch null.
--
-- Note this gives up two SENIOR_MANAGER-only capabilities for those users: deleting training
-- records and branches, and overriding a deal decision. A compliance officer may appoint a
-- SENIOR_MANAGER from Settings > Users if a firm needs one back.
UPDATE app_user u
SET    role = 'AML_COMPLIANCE_OFFICER'
FROM   real_estate_firm f
WHERE  u.role = 'SENIOR_MANAGER'
  AND  u.real_estate_firm_id = f.id
  AND  LOWER(u.email) = LOWER(f.compliance_officer_email);
