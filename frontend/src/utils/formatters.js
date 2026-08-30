// Shared display formatters. Centralises the money + relative-time helpers that were
// previously copy-pasted across DealCard / DealsTable / review screens.
//
// Money is denominated in the currency of the reporting entity in scope — a firm's country
// (V25 on real_estate_firm) decides whether its amounts are NZD or AUD. Components get this
// through useCurrency(); these functions are the primitives underneath.

/**
 * The currency each supported jurisdiction reports in. Keyed by the ISO country code stored on
 * the firm, which FirmService restricts to exactly these two.
 */
export const CURRENCY_BY_COUNTRY = {
  NZ: { code: 'NZD', locale: 'en-NZ' },
  AU: { code: 'AUD', locale: 'en-AU' },
};

/**
 * Currency for a firm's country, defaulting to NZD.
 *
 * The default covers two real cases: a scope not yet resolved to a country, where there is no single
 * currency to use, and a scope selection persisted before V25 that has no country on it.
 */
export function currencyFor(country) {
  return CURRENCY_BY_COUNTRY[country] ?? CURRENCY_BY_COUNTRY.NZ;
}

const FORMATTERS = new Map();

function formatterFor(country) {
  const { code, locale } = currencyFor(country);
  if (!FORMATTERS.has(code)) {
    FORMATTERS.set(code, new Intl.NumberFormat(locale, {
      style: 'currency', currency: code, maximumFractionDigits: 0,
    }));
  }
  return FORMATTERS.get(code);
}

/**
 * Money with the symbol only, e.g. $1,250,000. Returns '—' for null/undefined.
 *
 * NZD and AUD both render as a bare "$", so use this only where a column header or field label
 * already names the currency; otherwise use formatMoneyWithCode.
 */
export function formatMoney(value, country) {
  if (value == null) return '—';
  return formatterFor(country).format(value);
}

/** Money carrying its code, e.g. "NZD $1,250,000" — for standalone chips, pills and tiles. */
export function formatMoneyWithCode(value, country) {
  if (value == null) return '—';
  return `${currencyFor(country).code} ${formatterFor(country).format(value)}`;
}

/**
 * Compact money for dense tiles, e.g. $4.2M, $850K, $1,250.
 * Keeps one decimal for millions/thousands, drops trailing .0.
 */
export function formatMoneyCompact(value, country) {
  if (value == null) return '—';
  const { locale } = currencyFor(country);
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000)     return `${sign}$${trim(abs / 1_000)}K`;
  return `${sign}$${abs.toLocaleString(locale)}`;
}

function trim(n) {
  return (Math.round(n * 10) / 10).toString();
}

// ── Valuation ranges ──────────────────────────────────────────────────────────────
// A deal's worth is captured as the broker's min–max estimate rather than a single figure,
// so every money surface renders a range. `fallback` carries transactionValue for deals
// created before the range existed; those still show one number, which is what they hold.

/** Range of the two bounds that are present, e.g. "$800,000 – $900,000". */
export function formatMoneyRange(min, max, country, fallback = null) {
  return buildRange(min, max, fallback, (v) => formatMoney(v, country));
}

/** Compact range for dense tiles and cards, e.g. "$800K – $900K". */
export function formatMoneyRangeCompact(min, max, country, fallback = null) {
  return buildRange(min, max, fallback, (v) => formatMoneyCompact(v, country));
}

/** Range carrying its currency code, e.g. "NZD $800,000 – $900,000". */
export function formatMoneyRangeWithCode(min, max, country, fallback = null) {
  const range = buildRange(min, max, fallback, (v) => formatMoney(v, country));
  if (range === '—') return range;
  return `${currencyFor(country).code} ${range}`;
}

function buildRange(min, max, fallback, fmt) {
  // An equal pair is one number the broker happened to enter twice — showing "$X – $X"
  // reads as a mistake rather than as precision.
  if (min != null && max != null) {
    return Number(min) === Number(max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  }
  if (max != null) return `up to ${fmt(max)}`;
  if (min != null) return `from ${fmt(min)}`;
  if (fallback != null) return fmt(fallback);
  return '—';
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
