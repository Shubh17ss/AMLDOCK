import { DEAL_STATUS_META } from '../../../data/dealStatus.js';
import { PROPERTY_TYPES } from '../../../data/propertyTypes.js';
import { nodeTypeLabel } from '../../../api/ownership.js';

/**
 * Colours and labels for the report's three breakdowns, in the order the server sends them.
 *
 * Colours are read from the theme's CSS variables as literal hex: the chart library derives
 * hover shades from them, and the PDF renderer cannot resolve `var(--…)` at all. Each has the
 * light theme's value as a fallback, for a render before the stylesheet has loaded.
 *
 * Status follows the deal chips (data/dealStatus.js): Closed is the info chip's blue rather than
 * the muted dot, which beside New's slate would make two bars of one grey.
 */

function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
}

/** Resolved once per call so a theme change is picked up by the next render or export. */
export function reportColours() {
  const slate = cssVar('--cl-draft', '#64748B');
  const amber = cssVar('--cl-review', '#B45309');
  const red = cssVar('--cl-rejected', '#DC2626');
  const deepRed = cssVar('--cl-err-text', '#9B1C1C');
  const green = cssVar('--cl-approved', '#15803D');
  const blue = cssVar('--cl-blue', '#1B5FE3');
  const unknown = cssVar('--cl-switch-track', '#C7D0DE');
  return {
    status: { NEW: slate, REVIEW: amber, ON_HOLD: red, VERIFIED: green, CLOSED: blue },
    risk: { LOW: green, MEDIUM: amber, HIGH: red, NOT_ASSESSED: unknown },
    assurance: { ASSURED: green, ACTION_REQUIRED: deepRed, AWAITING: amber },
    ink: cssVar('--cl-ink', '#242C3C'),
    muted: cssVar('--cl-muted', '#5A6576'),
    hairline: cssVar('--cl-hairline2', '#D7DEEA'),
    track: cssVar('--cl-hairline', '#E7ECF3'),
    wash: cssVar('--cl-hover', '#F2F5FA'),
    blue,
  };
}

export const STATUS_KEYS = ['NEW', 'REVIEW', 'ON_HOLD', 'VERIFIED', 'CLOSED'];
export const RISK_KEYS = ['LOW', 'MEDIUM', 'HIGH', 'NOT_ASSESSED'];
export const ASSURANCE_KEYS = ['ASSURED', 'ACTION_REQUIRED', 'AWAITING'];

export const statusLabel = (k) => DEAL_STATUS_META[k]?.label ?? k;

const RISK_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', NOT_ASSESSED: 'Not assessed' };
export const riskLabel = (k) => RISK_LABELS[k] ?? k;

const ASSURANCE_LABELS = { ASSURED: 'Assured', ACTION_REQUIRED: 'Action required', AWAITING: 'Awaiting assurance' };
export const assuranceLabel = (k) => ASSURANCE_LABELS[k] ?? k;

const PROPERTY_LABELS = Object.fromEntries(PROPERTY_TYPES.map((t) => [t.value, t.label]));
export const propertyTypeLabel = (k) => (k === 'NOT_SET' ? 'Not set' : PROPERTY_LABELS[k] ?? k);

export const ownerTypeLabel = (k) => nodeTypeLabel(k);

/** "40%" or "12.5%"; the server already rounds to one decimal. */
export const percent = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** Minutes as hours to one decimal, e.g. 90 → "1.5". */
export const hours = (minutes) => (Math.round((minutes / 60) * 10) / 10).toLocaleString('en-NZ');
