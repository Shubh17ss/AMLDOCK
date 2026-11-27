import { apiClient } from './client.js';
import { compact } from './deals.js';

/**
 * Reporting › Management Reports. Four sections, each its own request, so the top of the report
 * draws while the rest is still being counted.
 *
 * Every function takes the same params:
 *   firmId    the reporting entity (ROOT and AUDIT must send it; everyone else is pinned)
 *   branchId  one branch, or omitted for the whole firm
 *   from, to  'YYYY-MM-DD', both inclusive; omit `from` for "all time"
 *   tz        IANA zone deciding where each day starts, e.g. 'Pacific/Auckland'
 */
const get = (section) => async (params = {}) => {
  const { data } = await apiClient.get(`/reports/management/${section}`, { params: compact(params) });
  return data;
};

/** `{ created, open, signedOff, highRisk, actionRequired, byStatus, byRisk, byAssurance }` */
export const getReportOverview = get('overview');

/** `{ rows: [Row], total: Row }`, Row = `{ propertyType, created, createdPercent, verified, closed,
 *  verifiedAllTime, unverifiedAllTime, sold, averageSalePrice, maxSalePrice }` */
export const getReportPropertyTypes = get('property-types');

/** `{ rows: [Row], total: Row }`, Row = `{ ownerType, owners, overseas, reused, exceptions }` */
export const getReportOwners = get('owners');

/** `{ summary, people: [{ userId, fullName, role, branchName, coursesAssigned, coursesPassed,
 *  coursesOverdue, sessionsAssigned, sessionsAttended, minutesAttended, lastCompletedAt }] }` */
export const getReportTraining = get('training');
