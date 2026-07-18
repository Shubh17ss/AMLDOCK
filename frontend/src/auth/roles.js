// Central role model — mirrors backend nz.amldock.user.Role.
// Keep this in sync with Role.java / RoleRules.

export const ROLES = [
  'ROOT',
  'AML_COMPLIANCE_OFFICER',
  'SENIOR_MANAGER',
  'SALES_MANAGER',
  'AGENT',
  'AGENT_PA',
  'ADMIN',
];

export const ROLE_LABELS = {
  ROOT: 'Platform Administrator',
  AML_COMPLIANCE_OFFICER: 'AML Compliance Officer',
  SENIOR_MANAGER: 'Senior Manager',
  SALES_MANAGER: 'Sales Manager',
  AGENT: 'Agent',
  AGENT_PA: 'Agent PA',
  ADMIN: 'Branch Admin',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || '';
}

// Privilege rank — a user may create any role ranked strictly below their own
// (i.e. any user can create users with lower privileges; ROOT can create everyone).
export const PRIVILEGE_RANK = {
  ROOT: 4,
  AML_COMPLIANCE_OFFICER: 3,
  SENIOR_MANAGER: 3,
  SALES_MANAGER: 2,
  AGENT: 1,
  AGENT_PA: 1,
  ADMIN: 1,
};

// Tier helpers (match the backend firm/branch linkage rules).
const FIRM_LEVEL = new Set(['AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER']);
const BRANCH_LEVEL = new Set(['SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN']);

export const isFirmLevel = (role) => FIRM_LEVEL.has(role);
export const isBranchLevel = (role) => BRANCH_LEVEL.has(role);

// Mirrors Role.canCreate: strictly-lower rank, plus firm-level staff appointing firm-level
// peers within their own reporting entity.
export function canCreateRole(role, target) {
  if (isFirmLevel(role) && isFirmLevel(target)) return true;
  return (PRIVILEGE_RANK[role] ?? 0) > (PRIVILEGE_RANK[target] ?? 0);
}

export function creatableRoles(role) {
  return ROLES.filter((target) => canCreateRole(role, target));
}
export const requiresFirm = (role) => FIRM_LEVEL.has(role) || BRANCH_LEVEL.has(role);
export const requiresBranch = (role) => BRANCH_LEVEL.has(role);

// Privilege groups used by route guards / page checks.
export const DEAL_AUTHOR_ROLES = ['AGENT', 'AGENT_PA', 'ADMIN'];
export const DEAL_REVIEWER_ROLES = ['AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'];
export const DELETE_ROLES = ['ROOT', 'SENIOR_MANAGER'];
export const USER_MANAGER_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'SALES_MANAGER'];
// Settings › Users and Settings › Reporting Entities. ROOT sees the platform; firm-level staff
// see the same screens scoped by the API to their own reporting entity.
export const SETTINGS_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'];

export const isDealAuthor = (role) => DEAL_AUTHOR_ROLES.includes(role);
export const isDealReviewer = (role) => DEAL_REVIEWER_ROLES.includes(role);
export const canDelete = (role) => DELETE_ROLES.includes(role);
export const canManageUsers = (role) => USER_MANAGER_ROLES.includes(role);
export const canOverride = (role) => role === 'SENIOR_MANAGER';

/**
 * Coarse navigation/home profile a role maps to:
 *   'agent'        → AGENT / AGENT_PA / ADMIN (author & view their own deals)
 *   'salesManager' → SALES_MANAGER (branch CDD view, creates branch users)
 *   'firmReviewer' → AML_COMPLIANCE_OFFICER / SENIOR_MANAGER (review queue, firm scope)
 *   'root'         → ROOT (platform admin)
 */
export function navProfileFor(role) {
  if (isDealAuthor(role)) return 'agent';
  if (role === 'SALES_MANAGER') return 'salesManager';
  if (isFirmLevel(role)) return 'firmReviewer';
  if (role === 'ROOT') return 'root';
  return 'agent';
}
