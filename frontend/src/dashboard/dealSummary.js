import { useQuery } from '@tanstack/react-query';
import { getDealSummary, listDeals } from '../api/deals.js';
import { useDashboardScope } from './DashboardScope.jsx';

/**
 * The dashboards' figures, computed on the server over every deal in scope. They used to download
 * the whole deals list and count it here, which cost as much as the firm's entire book on every
 * visit.
 *
 * `scoped` follows the sidebar's firm/branch selection; the root dashboard passes false to see
 * every firm, as it always has.
 */
export function useDealSummary({ scoped = true } = {}) {
  const { firm, branch } = useDashboardScope();
  const firmId = scoped ? firm?.id ?? null : null;
  const branchId = scoped ? branch?.id ?? null : null;
  return useQuery({
    queryKey: ['deals', 'summary', firmId, branchId],
    queryFn: () => getDealSummary({ firmId, branchId }),
  });
}

/** A few deals for a dashboard list tile, e.g. `{ size: 5, sort: 'updatedAt' }`. */
export function useDealSample(params, { scoped = true } = {}) {
  const { firm, branch } = useDashboardScope();
  const scope = scoped ? { firmId: firm?.id, branchId: branch?.id } : {};
  return useQuery({
    queryKey: ['deals', 'sample', params, scope.firmId ?? null, scope.branchId ?? null],
    queryFn: () => listDeals({ ...params, ...scope }),
    select: (page) => page.items,
  });
}

/** How many deals are in any of `statuses`. */
export const countOf = (summary, ...statuses) =>
  statuses.reduce((n, s) => n + (summary?.byStatus?.[s]?.count ?? 0), 0);

/**
 * Value of the deals in any of `statuses`: valuation max, falling back to transaction value. The
 * conservative read for AML value thresholds, as the client-side sum was.
 */
export const valueOf = (summary, ...statuses) =>
  statuses.reduce((n, s) => n + Number(summary?.byStatus?.[s]?.valueSum ?? 0), 0);

/** Deals in any of `statuses` changed within the last 30 days. */
export const recentOf = (summary, ...statuses) =>
  statuses.reduce((n, s) => n + (summary?.byStatus?.[s]?.updatedLast30Days ?? 0), 0);

/** The earliest createdAt across `statuses`, as an ISO string, or null. */
export const oldestOf = (summary, ...statuses) =>
  statuses.map((s) => summary?.byStatus?.[s]?.oldestCreatedAt).filter(Boolean).sort()[0] ?? null;
