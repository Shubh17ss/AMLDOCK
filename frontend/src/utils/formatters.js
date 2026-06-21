// Shared display formatters. Centralises the NZD + relative-time helpers that were
// previously copy-pasted across DealCard / DealsTable / review screens.

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

/** Full NZD currency, e.g. $1,250,000. Returns '—' for null/undefined. */
export function formatNZD(value) {
  if (value == null) return '—';
  return NZD.format(value);
}

/**
 * Compact NZD for dense tiles, e.g. $4.2M, $850K, $1,250.
 * Keeps one decimal for millions/thousands, drops trailing .0.
 */
export function formatNZDCompact(value) {
  if (value == null) return '—';
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000)     return `${sign}$${trim(abs / 1_000)}K`;
  return `${sign}$${abs.toLocaleString('en-NZ')}`;
}

function trim(n) {
  return (Math.round(n * 10) / 10).toString();
}

/** Short date, e.g. "21 Jun 2026". */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Relative time: "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}
