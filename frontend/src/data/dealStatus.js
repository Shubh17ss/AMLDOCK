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

export const canHandover = (s) => s === 'NEW';
export const canStartReview = (s) => s === 'HANDOVER';
export const canHold = (s) => s === 'REVIEW';
export const canVerify = (s) => s === 'REVIEW';
export const canClose = (s) => s === 'VERIFIED';
export const canRevert = (s) => s === 'HANDOVER' || s === 'REVIEW' || s === 'ON_HOLD';

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
