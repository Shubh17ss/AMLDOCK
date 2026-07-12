import AssessmentIcon from '@mui/icons-material/Assessment';
import PolicyIcon from '@mui/icons-material/Policy';
import SummarizeIcon from '@mui/icons-material/Summarize';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import RuleIcon from '@mui/icons-material/Rule';
import GavelIcon from '@mui/icons-material/Gavel';
import SchoolIcon from '@mui/icons-material/School';
import FlagIcon from '@mui/icons-material/Flag';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import InsightsIcon from '@mui/icons-material/Insights';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';

// ── Compliance module registry ──────────────────────────────────────────────
// Single source of truth for the workspace surface: the sidebar, the dashboard
// card hub, the placeholder routes, and the page titles all read from here so
// they can never drift.
//
// Each GROUP has a clickable landing route (`to`) that shows a section view; the
// CDD group's landing is the role-aware stats dashboard (CDD_REGISTER_PATH).
// Each ITEM is a module — all placeholders we fill in later.

export const DASHBOARD_PATH = '/dashboard';
export const CDD_REGISTER_PATH = '/cdd';
export const DEALS_PATH = '/cdd/deals';

export const MODULE_GROUPS = [
  {
    group: 'Documents', slug: 'documents', to: '/documents', title: 'Documents',
    items: [
      { id: 'risk-assessment',      label: 'Risk Assessment',      to: '/documents/risk-assessment',      icon: <AssessmentIcon /> },
      { id: 'compliance-programme', label: 'Compliance Programme', to: '/documents/compliance-programme', icon: <PolicyIcon /> },
      { id: 'annual-report',        label: 'Annual Report',        to: '/documents/annual-report',        icon: <SummarizeIcon /> },
    ],
  },
  {
    // The CDD header opens the CDD Register — the role-aware stats dashboard.
    group: 'CDD', slug: 'cdd', to: CDD_REGISTER_PATH, title: 'CDD Register',
    items: [
      { id: 'deals',             label: 'Deals',             to: DEALS_PATH,               icon: <BusinessCenterIcon /> },
      { id: 'beneficial-owners', label: 'Beneficial Owners', to: '/cdd/beneficial-owners', icon: <AccountTreeIcon /> },
      { id: 'echecks',           label: 'eChecks',           to: '/cdd/echecks',           icon: <FactCheckIcon /> },
    ],
  },
  {
    group: 'Registers', slug: 'registers', to: '/registers', title: 'Registers',
    items: [
      { id: 'cdd-exceptions',        label: 'CDD Exceptions',        to: '/registers/cdd-exceptions',        icon: <RuleIcon /> },
      { id: 'peps',                  label: 'PEPs',                  to: '/registers/peps',                  icon: <GavelIcon /> },
      { id: 'staff-training',        label: 'Staff Training',        to: '/registers/staff-training',        icon: <SchoolIcon /> },
      { id: 'suspicious-activities', label: 'Suspicious Activities', to: '/registers/suspicious-activities', icon: <FlagIcon /> },
    ],
  },
  {
    group: 'Client Risk', slug: 'client-risk', to: '/client-risk', title: 'Client Risk',
    items: [
      { id: 'client-risk',  label: 'Client Risk',  to: '/client-risk',              icon: <PersonSearchIcon /> },
      { id: 'transactions', label: 'Transactions', to: '/client-risk/transactions', icon: <ReceiptLongIcon /> },
    ],
  },
  {
    group: 'Monitoring', slug: 'monitoring', to: '/monitoring', title: 'Monitoring',
    items: [
      { id: 'management-reports', label: 'Management Reports', to: '/monitoring/reports', icon: <InsightsIcon /> },
    ],
  },
  {
    group: 'Settings', slug: 'settings', to: '/settings', title: 'Settings',
    items: [
      { id: 'users',              label: 'Users',              to: '/settings/users',              icon: <PeopleIcon /> },
      { id: 'reporting-entities', label: 'Reporting Entities', to: '/settings/reporting-entities', icon: <BusinessIcon /> },
    ],
  },
];

/** Flattened list of every module item, in group order. */
export const MODULES = MODULE_GROUPS.flatMap((g) => g.items);

/** Module paths that render real pages — everything else gets a placeholder. */
export const IMPLEMENTED_PATHS = [
  CDD_REGISTER_PATH,
  DEALS_PATH,
  '/documents',
  '/documents/risk-assessment',
  '/documents/compliance-programme',
  '/documents/annual-report',
  '/settings/users',
  '/settings/reporting-entities',
];

/**
 * Every placeholder route to register: group landings + module items, deduped by
 * path, excluding routes that render real pages. Titles come from the group/item label.
 */
export function placeholderRoutes() {
  const seen = new Set(IMPLEMENTED_PATHS);
  const out = [];
  const add = (to, title) => { if (!seen.has(to)) { seen.add(to); out.push({ to, title }); } };
  MODULE_GROUPS.forEach((g) => add(g.to, g.title));
  MODULES.forEach((m) => add(m.to, m.label));
  return out;
}

/** Longest-prefix page-title lookup for the app bar (group landings + items). */
export function moduleTitleFor(pathname) {
  const titled = [
    ...MODULE_GROUPS.map((g) => ({ to: g.to, title: g.title })),
    ...MODULES.map((m) => ({ to: m.to, title: m.label })),
  ];
  const match = titled
    .filter((t) => pathname === t.to || pathname.startsWith(t.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.title ?? null;
}
