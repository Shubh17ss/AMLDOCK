// The deal lifecycle, as the frontend needs to know it.
//
// Keep in sync with DealStatus and DealLifecycleService.RULES in the backend
// (backend/src/main/java/nz/amldock/deal/). The server is authoritative and rejects anything
// these predicates let through — they exist only to decide which buttons render.
//
//   NEW ──handover──▶ HANDOVER ──start review──▶ REVIEW ──verify──▶ VERIFIED ──close──▶ CLOSED
//    ▲                    │                        │
//    │                    │                        └──hold──▶ ON_HOLD
//    └────────revert──────┴────────────────────────────────────────┘
//
// There is no rejected state: a deal that cannot pass sits in ON_HOLD, or goes back to NEW for
// the broker to fix. ON_HOLD's only exit is back to NEW.

import { tokens } from '../theme/theme.js';

export const DEAL_STATUSES = ['NEW', 'HANDOVER', 'REVIEW', 'ON_HOLD', 'VERIFIED', 'CLOSED'];

/** Status filter options, with the all-statuses sentinel first. */
export const DEAL_STATUS_FILTERS = ['ALL', ...DEAL_STATUSES];

/**
 * Status → presentation. One map; there were three.
 *
 * The colour tokens are GENERIC semantic colours shared with ~25 unrelated screens (training
 * pages, document registers, RiskRatingChip, VoiceRecorderField). Their names are historical
 * and must not be renamed to match these statuses — only this mapping changes.
 *
 *   chip → MUI Chip `color`        dot → raw colour for pills and dashboard tiles
 */
export const DEAL_STATUS_META = {
  NEW:      { label: 'New',       chip: 'default', dot: tokens.draft },
  HANDOVER: { label: 'Handover',  chip: 'info',    dot: tokens.submitted },
  REVIEW:   { label: 'In review', chip: 'warning', dot: tokens.review },
  ON_HOLD:  { label: 'On hold',   chip: 'error',   dot: tokens.rejected },
  VERIFIED: { label: 'Verified',  chip: 'success', dot: tokens.approved },
  CLOSED:   { label: 'Closed',    chip: 'default', dot: tokens.muted },
};

export const dealStatusLabel = (s) =>
  (s === 'ALL' ? 'All' : DEAL_STATUS_META[s]?.label ?? s ?? '—');
export const dealStatusColor = (s) => DEAL_STATUS_META[s]?.chip ?? 'default';
export const dealStatusDot = (s) => (s === 'ALL' ? tokens.muted : DEAL_STATUS_META[s]?.dot ?? tokens.muted);

/* ---------- lifecycle predicates ---------- */

/** Content may only be changed while the deal is NEW. */
export const isEditable = (s) => s === 'NEW';

/**
 * Whether this role may change a deal's content in this status.
 *
 * Mirrors `DealLifecycleService.canEditContent`. The broker who authored it edits while it
 * is still theirs (NEW); a firm-level reviewer edits throughout the states where the deal
 * sits with compliance, because that is when they are working on it. VERIFIED and CLOSED
 * carry a sign-off and are closed to both — revert or override first.
 */
const REVIEWER_EDITABLE = ['NEW', 'HANDOVER', 'REVIEW', 'ON_HOLD'];

export const canEditContent = (status, role) =>
  (role === 'AML_COMPLIANCE_OFFICER' || role === 'SENIOR_MANAGER')
    ? REVIEWER_EDITABLE.includes(status)
    : isEditable(status);

/**
 * Every status change a reviewer can make, as a table.
 *
 * <p>Mirrors `DealLifecycleService.RULES`, `noteRequired` included — that is the server's own
 * column, and the Update status dialog reads it to decide whether to ask for a reason. Handover
 * is absent on purpose: it is the submit action of the broker's create form, not a status a
 * reviewer picks off a list.
 *
 * <p>`blurb` is what the reviewer reads beside each status. It says what the status means and who
 * the deal lands on, because "Verified" alone is exactly the button this table replaced.
 */
export const STATUS_TRANSITIONS = [
  {
    to: 'REVIEW', from: ['HANDOVER'], action: 'start', noteRequired: false,
    blurb: 'Take this deal on. It stays with compliance until you decide.',
  },
  {
    to: 'VERIFIED', from: ['REVIEW'], action: 'verify', noteRequired: true,
    blurb: 'Compliance sign-off. Record what you checked — it is kept against the deal.',
  },
  {
    to: 'ON_HOLD', from: ['REVIEW'], action: 'hold', noteRequired: true,
    blurb: "Parked with compliance. Say what you're waiting on; the broker sees it on the timeline.",
  },
  {
    to: 'NEW', from: ['HANDOVER', 'REVIEW', 'ON_HOLD'], action: 'revert', noteRequired: true,
    blurb: 'Back to the broker for changes. Say what needs doing — they see it on the timeline.',
  },
  {
    to: 'CLOSED', from: ['VERIFIED'], action: 'close', noteRequired: false,
    blurb: 'The file is finished. Nothing further happens to this deal.',
  },
];

/** Where a deal in this status can go next, in the order a reviewer should read them. */
export const transitionsFrom = (status) =>
  STATUS_TRANSITIONS.filter((t) => t.from.includes(status));

/** Whether the table holds this move. The predicates below are all this question, narrowed. */
const allows = (action, status) =>
  STATUS_TRANSITIONS.some((t) => t.action === action && t.from.includes(status));

export const canHandover = (s) => s === 'NEW';
export const canStartReview = (s) => allows('start', s);
export const canHold = (s) => allows('hold', s);
export const canVerify = (s) => allows('verify', s);
export const canClose = (s) => allows('close', s);
export const canRevert = (s) => allows('revert', s);

/**
 * Whether the broker may revert it themselves.
 *
 * Only from HANDOVER, and only their own deal: pulling back an early handover is the broker's
 * mistake to undo, but once review has started, sending a deal back is a compliance decision.
 * Mirrors DealLifecycleService.assertRevert.
 */
export const canBrokerRevert = (s) => s === 'HANDOVER';

/** The reviewer workspace is useful from handover onward, decided or not. */
export const isReviewable = (s) => Boolean(s) && s !== 'NEW';

/** Deals still needing compliance attention — what a reviewer's queue tiles count. */
export const isOpenForReview = (s) => s === 'HANDOVER' || s === 'REVIEW' || s === 'ON_HOLD';
