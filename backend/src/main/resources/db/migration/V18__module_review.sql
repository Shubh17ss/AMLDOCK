-- Generalise the review schedule from the three compliance-document registers to any
-- compliance module. `category` held a ComplianceDocCategory enum constrained by a CHECK;
-- it becomes `module_key`, holding the module id from the frontend module registry
-- (kebab-case, e.g. 'peps', 'staff-training'). Validation moves to the application layer
-- (nz.amldock.compliancedoc.ReviewableModules) so adding a module needs no migration.

ALTER TABLE document_review DROP CONSTRAINT chk_docreview_category;

ALTER TABLE document_review RENAME COLUMN category TO module_key;

-- Re-key the three existing document registers onto their module-registry ids.
UPDATE document_review SET module_key = 'risk-assessment'      WHERE module_key = 'RISK_ASSESSMENT';
UPDATE document_review SET module_key = 'compliance-programme' WHERE module_key = 'COMPLIANCE_PROGRAMME';
UPDATE document_review SET module_key = 'annual-report'        WHERE module_key = 'ANNUAL_REPORT';

-- The uq_docreview_scope unique index follows the column through the rename, so one review
-- row per (firm, branch, module) still holds.
