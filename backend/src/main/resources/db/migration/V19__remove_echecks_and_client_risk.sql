-- The eChecks module and the whole Client Risk section were removed from the workspace.
-- Their review rows are now unreachable (DocumentReviewService only reports modules listed
-- in ReviewableModules.KEYS) but would still hold slots in uq_docreview_scope, so clear them.
-- No-op where those modules never had a review date set.

DELETE FROM document_review
 WHERE module_key IN ('echecks', 'client-risk', 'transactions');
