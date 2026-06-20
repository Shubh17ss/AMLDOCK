-- Firm onboarding form redesign.
-- Drop trading name + head-office address + the generic contact fields; replace with explicit
-- liaison and senior-manager contact blocks, plus the expected branch count.

ALTER TABLE real_estate_firm
    DROP COLUMN IF EXISTS trading_name,
    DROP COLUMN IF EXISTS head_office_address,
    DROP COLUMN IF EXISTS contact_email,
    DROP COLUMN IF EXISTS contact_phone,
    ADD COLUMN liaison_name                  VARCHAR(255),
    ADD COLUMN liaison_email                 VARCHAR(255),
    ADD COLUMN liaison_contact_number        VARCHAR(64),
    ADD COLUMN senior_manager_name           VARCHAR(255),
    ADD COLUMN senior_manager_email          VARCHAR(255),
    ADD COLUMN senior_manager_contact_number VARCHAR(64),
    ADD COLUMN number_of_branches            INT;
