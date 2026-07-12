-- Compliance documents gain an optional branch dimension: a document can be
-- firm-wide (branch NULL) or tagged to one branch. Lists filter by the branch
-- selected in the UI (branch docs + firm-wide docs).

ALTER TABLE compliance_document
    ADD COLUMN firm_branch_id BIGINT REFERENCES firm_branch(id) ON DELETE SET NULL;

CREATE INDEX idx_compdoc_branch ON compliance_document(firm_branch_id);
