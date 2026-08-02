import AssessmentIcon from '@mui/icons-material/Assessment';
import PolicyIcon from '@mui/icons-material/Policy';
import SummarizeIcon from '@mui/icons-material/Summarize';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import RuleIcon from '@mui/icons-material/Rule';
import GavelIcon from '@mui/icons-material/Gavel';
import SchoolIcon from '@mui/icons-material/School';
import FlagIcon from '@mui/icons-material/Flag';
import InsightsIcon from '@mui/icons-material/Insights';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import PublicIcon from '@mui/icons-material/Public';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { canAccessAllModules } from '../auth/roles.js';

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
export const INTL_FUND_TRANSACTIONS_PATH = '/monitoring/international-fund-transaction-register';
export const SUSPICIOUS_ACTIVITIES_PATH = '/monitoring/suspicious-activities';

export const MODULE_GROUPS = [
  {
    group: 'Documents', slug: 'documents', to: '/documents', title: 'Documents',
    icon: <FolderRoundedIcon />,
    items: [
      { id: 'risk-assessment',      label: 'Risk Assessment',      to: '/documents/risk-assessment',      icon: <AssessmentIcon />,
        blurb: 'Upload risk assessment revisions and keep every past version on record.' },
      { id: 'compliance-programme', label: 'Compliance Programme', to: '/documents/compliance-programme', icon: <PolicyIcon />,
        blurb: 'Keep your AML compliance programme current with a full version history.' },
      { id: 'annual-report',        label: 'Annual Report',        to: '/documents/annual-report',        icon: <SummarizeIcon />,
        blurb: 'File each year’s annual report and track prior submissions.' },
    ],
  },
  {
    // The CDD header opens the CDD Register — the role-aware stats dashboard.
    group: 'CDD', slug: 'cdd', to: CDD_REGISTER_PATH, title: 'CDD Register',
    icon: <VerifiedUserRoundedIcon />,
    items: [
      { id: 'deals',             label: 'Listing Register',  to: DEALS_PATH,               icon: <BusinessCenterIcon />,
        blurb: 'Every listing and its customer due diligence, from capture through approval.' },
      { id: 'beneficial-owners', label: 'Beneficial Owners', to: '/cdd/beneficial-owners', icon: <AccountTreeIcon />,
        blurb: 'Map ownership structures and identify who ultimately controls each customer.' },
      { id: 'cdd-exceptions',    label: 'CDD Exceptions',    to: '/cdd/cdd-exceptions',    icon: <RuleIcon />,
        blurb: 'Track listings cleared with incomplete due diligence and their remediation.' },
      { id: 'peps',              label: 'PEPs',              to: '/cdd/peps',              icon: <GavelIcon />,
        blurb: 'Screen and record politically exposed persons found across your customers.' },
      { id: 'overseas-residents', label: 'Overseas Residents', to: '/cdd/overseas-residents', icon: <PublicIcon />,
        blurb: 'Enhanced due diligence for customers residing outside New Zealand.' },
    ],
  },
  {
    group: 'AML Training', slug: 'aml-training', to: '/aml-training', title: 'AML Training',
    icon: <WorkspacePremiumRoundedIcon />,
    items: [
      { id: 'staff-training', label: 'Staff Training', to: '/aml-training/staff-training', icon: <SchoolIcon />,
        blurb: 'AML training records for every staff member, with completion dates.' },
    ],
  },
  {
    group: 'Monitoring', slug: 'monitoring', to: '/monitoring', title: 'Monitoring',
    icon: <MonitorHeartRoundedIcon />,
    items: [
      { id: 'management-reports',    label: 'Management Reports',                    to: '/monitoring/reports',                            icon: <InsightsIcon />,
        blurb: 'Board-level AML reporting on obligations, breaches and remediation.' },
      { id: 'suspicious-activities', label: 'Suspicious Activities',                to: SUSPICIOUS_ACTIVITIES_PATH,                       icon: <FlagIcon />,
        blurb: 'Record suspicious activity reports and their submission to the FIU.' },
      { id: 'intl-fund-transfers',   label: 'International Fund Transaction Register', to: INTL_FUND_TRANSACTIONS_PATH,                      icon: <CurrencyExchangeIcon />,
        blurb: 'Log international fund transfers tied to a listing, with supporting evidence.' },
    ],
  },
  {
    // Admin configuration, not reviewable compliance artefacts — hence `reviewable: false`.
    group: 'Settings', slug: 'settings', to: '/settings', title: 'Settings',
    icon: <SettingsRoundedIcon />, reviewable: false,
    items: [
      { id: 'users',              label: 'Users',              to: '/settings/users',              icon: <PeopleIcon />,
        blurb: 'Invite staff, set roles and manage access to the workspace.' },
      { id: 'reporting-entities', label: 'Reporting Entities', to: '/settings/reporting-entities', icon: <BusinessIcon />,
        blurb: 'Manage reporting entities, their branches and firm details.' },
    ],
  },
];

/** Flattened list of every module item, in group order. */
export const MODULES = MODULE_GROUPS.flatMap((g) => g.items);

/**
 * Modules that carry a review schedule — every compliance module, i.e. everything outside
 * the Settings section (`reviewable: false`). The module `id` is the review key persisted
 * as document_review.module_key.
 *
 * Keep in sync with ReviewableModules.KEYS in the backend
 * (backend/src/main/java/nz/amldock/compliancedoc/ReviewableModules.java).
 */
export const REVIEWABLE_MODULE_KEYS = new Set(
  MODULE_GROUPS.filter((g) => g.reviewable !== false).flatMap((g) => g.items.map((i) => i.id)),
);

export const isReviewableModule = (id) => REVIEWABLE_MODULE_KEYS.has(id);

/** The CDD section — the only group visible to non-privileged roles. */
export const CDD_GROUP = MODULE_GROUPS.find((g) => g.slug === 'cdd');

/**
 * Groups a role may see in the sidebar / dashboard hub. Privileged roles (ROOT, AML CO,
 * Senior Manager) get the whole workspace; everyone else is confined to the CDD section.
 */
export function visibleGroupsFor(role) {
  return canAccessAllModules(role) ? MODULE_GROUPS : MODULE_GROUPS.filter((g) => g.slug === 'cdd');
}

/**
 * Paths inside the CDD section (its landing + items). Used to keep those routes open to
 * everyone while non-CDD module routes are gated to the full-workspace roles.
 */
export const CDD_SECTION_PATHS = new Set([CDD_GROUP.to, ...CDD_GROUP.items.map((i) => i.to)]);

/**
 * Groups whose landing route renders the generic section page (a card per module). Every
 * group except CDD, whose landing is the purpose-built stats dashboard (CDD_REGISTER_PATH).
 */
export const SECTION_LANDING_GROUPS = MODULE_GROUPS.filter((g) => g.to !== CDD_REGISTER_PATH);

/** Module paths that render real pages — everything else gets a placeholder. */
export const IMPLEMENTED_PATHS = [
  CDD_REGISTER_PATH,
  DEALS_PATH,
  '/documents/risk-assessment',
  '/documents/compliance-programme',
  '/documents/annual-report',
  '/settings/users',
  '/settings/reporting-entities',
  INTL_FUND_TRANSACTIONS_PATH,
  SUSPICIOUS_ACTIVITIES_PATH,
  // Group landings — all handled by SectionLandingPage.
  ...SECTION_LANDING_GROUPS.map((g) => g.to),
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
