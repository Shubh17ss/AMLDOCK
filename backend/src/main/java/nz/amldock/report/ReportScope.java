package nz.amldock.report;

import nz.amldock.deal.DealScope;

/**
 * What one report request covers, resolved and checked by {@link ManagementReportService}.
 *
 * @param deals    the caller's deal scope, for the deal-based sections
 * @param firmId   the firm, always set: there is no platform-wide report
 * @param branchId the branch, or null for the whole firm; known to belong to {@code firmId}
 */
record ReportScope(DealScope deals, long firmId, Long branchId, ReportWindow window) {
}
