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

// Which roles each role may create (top tier creates the tier below, never otherwise).
export const CREATABLE_ROLES = {
  ROOT: ['AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'],
  AML_COMPLIANCE_OFFICER: ['SALES_MANAGER'],
  SENIOR_MANAGER: ['SALES_MANAGER'],
  SALES_MANAGER: ['AGENT', 'AGENT_PA', 'ADMIN'],
  AGENT: [],
  AGENT_PA: [],
  ADMIN: [],
};

export function creatableRoles(role) {
  return CREATABLE_ROLES[role] || [];
}

// Tier helpers (match the backend firm/branch linkage rules).
const FIRM_LEVEL = new Set(['AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER']);
const BRANCH_LEVEL = new Set(['SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN']);

export const isFirmLevel = (role) => FIRM_LEVEL.has(role);
export const isBranchLevel = (role) => BRANCH_LEVEL.has(role);
export const requiresFirm = (role) => FIRM_LEVEL.has(role) || BRANCH_LEVEL.has(role);
export const requiresBranch = (role) => BRANCH_LEVEL.has(role);

// Privilege groups used by route guards / page checks.
export const DEAL_AUTHOR_ROLES = ['AGENT', 'AGENT_PA', 'ADMIN'];
export const DEAL_REVIEWER_ROLES = ['AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'];
export const DELETE_ROLES = ['ROOT', 'SENIOR_MANAGER'];
export const USER_MANAGER_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'SALES_MANAGER'];

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
