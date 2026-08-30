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
  'AUDIT',
  'FINANCE',
];

export const ROLE_LABELS = {
  ROOT: 'Platform Administrator',
  AML_COMPLIANCE_OFFICER: 'AML Compliance Officer',
  SENIOR_MANAGER: 'Senior Manager',
  SALES_MANAGER: 'Sales Manager',
  AGENT: 'Agent',
  AGENT_PA: 'Agent PA',
  ADMIN: 'Branch Admin',
  AUDIT: 'Auditor',
  FINANCE: 'Finance',
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
  // Specialists rank alongside the sales manager so ROOT and firm-level staff may appoint them.
  // canCreateRole stops them appointing anyone in turn.
  AUDIT: 2,
  FINANCE: 2,
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
// peers within their own reporting entity. The specialists manage nobody.
export function canCreateRole(role, target) {
  if (role === 'AUDIT' || role === 'FINANCE') return false;
  if (isFirmLevel(role) && isFirmLevel(target)) return true;
  return (PRIVILEGE_RANK[role] ?? 0) > (PRIVILEGE_RANK[target] ?? 0);
}

export function creatableRoles(role) {
  return ROLES.filter((target) => canCreateRole(role, target));
}
export const requiresFirm = (role) => FIRM_LEVEL.has(role) || BRANCH_LEVEL.has(role) || role === 'FINANCE';
export const requiresBranch = (role) => BRANCH_LEVEL.has(role);

// ── The two specialist roles ────────────────────────────────────────────────
// Mirrors nz.amldock.user.Role. Neither is firm-level: that predicate carries meaning beyond
// linkage (training assignability, firm-peer appointment) these roles have no part in.

/** Reads every section, writes nothing. The server enforces this in AuditReadOnlyFilter. */
export const READ_ONLY_ROLES = ['AUDIT'];
export const isReadOnly = (role) => READ_ONLY_ROLES.includes(role);
/** Gate for action controls the allow-list helpers below don't already cover. */
export const canWrite = (role) => Boolean(role) && !isReadOnly(role);

/** Sees every reporting entity rather than one — a visibility question, not a write grant. */
export const seesAllFirms = (role) => role === 'ROOT' || role === 'AUDIT';

/** FINANCE sees these two Monitoring modules and nothing else in the workspace. */
export const FINANCE_MODULE_IDS = ['management-reports', 'intl-fund-transfers'];

// Privilege groups used by route guards / page checks.
export const DEAL_AUTHOR_ROLES = ['AGENT', 'AGENT_PA', 'ADMIN'];
export const DEAL_REVIEWER_ROLES = ['AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'];
// Who may *open* a deal, which is wider than who authors one and deliberately a separate list.
// Authorship carries rights that outlive creation — editing a NEW deal, submitting it, deleting
// your own — and a sales manager or compliance officer starting a file does not acquire those.
// Mirrors DealLifecycleService.canCreateDeal. ROOT is absent because it belongs to no firm, and
// AUDIT because it writes nothing anywhere.
export const DEAL_CREATOR_ROLES = [
  ...DEAL_AUTHOR_ROLES, 'SALES_MANAGER', ...DEAL_REVIEWER_ROLES,
];
export const DELETE_ROLES = ['ROOT', 'SENIOR_MANAGER'];
// Who may set a document register's review date / mark it complete.
export const REVIEW_MANAGER_ROLES = ['ROOT', 'SENIOR_MANAGER', 'AML_COMPLIANCE_OFFICER'];
export const USER_MANAGER_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'SALES_MANAGER'];
// Settings › Users and Settings › Reporting Entities. ROOT sees the platform; firm-level staff
// see the same screens scoped by the API to their own reporting entity. AUDIT opens them too but
// every control inside is gated by canWrite / canManageUsers, so it only reads.
export const SETTINGS_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'AUDIT'];
// Who can repair a dead-ended dashboard scope themselves, as opposed to merely reading the screen
// where it is repaired. SETTINGS_ROLES opens Settings › Reporting Entities; only these three may
// write there — FirmController gates POST /firms on ROOT and POST /firms/{id}/branches on all
// three, and AuditReadOnlyFilter refuses AUDIT's writes everywhere regardless. Derived rather than
// listed so it cannot drift from SETTINGS_ROLES or from the read-only set.
export const SCOPE_SETUP_ROLES = SETTINGS_ROLES.filter((r) => canWrite(r));
// Settings › Audit Log. ROOT sees the platform trail; a compliance officer or senior manager
// sees their own entity's, scoped server-side by actor in AuditService.search.
export const AUDIT_LOG_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'];
// Settings › Notifications. Who may open the firm-wide matrix and change someone else's toggles.
// AUDIT reads it like every other section; the switches inside are gated by canWrite, and the
// server refuses its writes at AuditReadOnlyFilter regardless.
export const NOTIFICATION_ADMIN_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER', 'AUDIT'];

// ── Deal email notifications ────────────────────────────────────────────────
// Mirrors nz.amldock.notification.NotificationEligibility — keep the two in step. Everyone else
// manages their own toggles on the Profile page, so this is about who has any to manage.
//
// ROOT, AUDIT and FINANCE are excluded by judgement rather than by read scope: assertCanRead
// forbids only FINANCE and hands ROOT and AUDIT everything. ROOT belongs to no firm, and AUDIT
// reads the record rather than being alerted by it.
export const NOTIFIABLE_ROLES = [
  'AGENT', 'AGENT_PA', 'ADMIN', 'SALES_MANAGER', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER',
];
export const canReceiveDealNotifications = (role) => NOTIFIABLE_ROLES.includes(role);
/** Firm-level staff have no branch of their own, so they choose branch by branch. */
export const choosesNotificationsPerBranch = (role) => isFirmLevel(role);

// Labels for nz.amldock.notification.DealNotificationEvent, in the order the columns render.
export const DEAL_NOTIFICATION_EVENTS = [
  { id: 'DEAL_CREATED', label: 'Deal created' },
  { id: 'DEAL_STATUS_CHANGED', label: 'Status changed' },
];

// Roles with the full compliance workspace. Everyone else is confined to the CDD section:
// only CDD modules are visible in the sidebar / dashboard hub and only those routes resolve.
export const FULL_WORKSPACE_ROLES = ['ROOT', 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER'];

// Who may reach a section at all. AUDIT sees every section (read-only); FINANCE is narrowed to
// two Monitoring modules by visibleGroupsFor, not by this list.
export const SECTION_READ_ROLES = [...FULL_WORKSPACE_ROLES, 'AUDIT'];
export const canAccessAllModules = (role) => SECTION_READ_ROLES.includes(role);
/** Route guard for FINANCE_MODULE_IDS and the Monitoring landing they sit under. */
export const FINANCE_SECTION_ROLES = [...SECTION_READ_ROLES, 'FINANCE'];

// Branch-level staff, as a route-guard list.
export const BRANCH_LEVEL_ROLES = ['SALES_MANAGER', 'AGENT', 'AGENT_PA', 'ADMIN'];

// AML Training › Staff Training: who runs training (creates sessions, manages providers).
export const TRAINING_MANAGER_ROLES = FULL_WORKSPACE_ROLES;
export const canManageTraining = (role) => TRAINING_MANAGER_ROLES.includes(role);
// Who may *see* the whole training register, as opposed to write to it — the managers plus the
// auditor. Mirrors TrainingSessionService.canViewWholeRegister; keep the two questions separate,
// or an auditor gets an empty register.
export const TRAINING_VIEWER_ROLES = [...TRAINING_MANAGER_ROLES, 'AUDIT'];

// Who can be *assigned* training, and so who the personal My Training page is for: a branch's
// own staff, plus the firm's compliance officers and senior managers — they run training and
// still have their own obligations to meet. ROOT is a platform account with no firm and never
// holds an assignment. Mirrored server-side in TrainingScope.assertAssignable.
export const TRAINING_ASSIGNABLE_ROLES = [
  ...BRANCH_LEVEL_ROLES, 'AML_COMPLIANCE_OFFICER', 'SENIOR_MANAGER',
];
export const canBeAssignedTraining = (role) => TRAINING_ASSIGNABLE_ROLES.includes(role);

export const isDealAuthor = (role) => DEAL_AUTHOR_ROLES.includes(role);
export const canCreateDeal = (role) => DEAL_CREATOR_ROLES.includes(role);
export const isDealReviewer = (role) => DEAL_REVIEWER_ROLES.includes(role);
export const canDelete = (role) => DELETE_ROLES.includes(role);
export const canManageReview = (role) => REVIEW_MANAGER_ROLES.includes(role);
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
