import dayjs from 'dayjs';

/**
 * The report's time window: whole days, inclusive at both ends, sent as 'YYYY-MM-DD' with the
 * browser's time zone. The server works out where each day starts in that zone, so a deal made
 * at 23:30 on 30 June belongs to the AML year it was made in.
 *
 * The AML year runs 1 July to 30 June: the period the AML/CFT annual report covers, and the
 * default here so the report lines up with the filing.
 */

const ISO = 'YYYY-MM-DD';

/** Start of the AML year `today` falls in. */
function amlYearStart(today) {
  const julyFirst = today.month(6).date(1).startOf('day');
  return today.isBefore(julyFirst) ? julyFirst.subtract(1, 'year') : julyFirst;
}

export const WINDOW_PRESETS = [
  {
    id: 'aml-year', label: 'This AML year',
    range: (t) => { const s = amlYearStart(t); return [s, s.add(1, 'year').subtract(1, 'day')]; },
  },
  {
    id: 'last-aml-year', label: 'Last AML year',
    range: (t) => { const s = amlYearStart(t).subtract(1, 'year'); return [s, s.add(1, 'year').subtract(1, 'day')]; },
  },
  { id: 'this-month', label: 'This month', range: (t) => [t.startOf('month'), t.endOf('month')] },
  { id: 'last-30', label: 'Last 30 days', range: (t) => [t.subtract(29, 'day'), t] },
  {
    id: 'this-quarter', label: 'This quarter',
    range: (t) => {
      const s = t.month(Math.floor(t.month() / 3) * 3).startOf('month');
      return [s, s.add(3, 'month').subtract(1, 'day')];
    },
  },
  { id: 'last-12-months', label: 'Last 12 months', range: (t) => [t.subtract(1, 'year').add(1, 'day'), t] },
  { id: 'all', label: 'All time', range: (t) => [null, t] },
];

export const CUSTOM = 'custom';
export const DEFAULT_PRESET = 'aml-year';

/**
 * The `{ from, to }` the server is asked for, as 'YYYY-MM-DD' strings (`from` null for all time).
 * Null when a custom range is incomplete or backwards, which leaves the queries switched off.
 */
export function resolveWindow(presetId, custom, today = dayjs()) {
  if (presetId === CUSTOM) {
    const { from, to } = custom ?? {};
    if (!from || !to || from > to) return null;
    return { from, to };
  }
  const preset = WINDOW_PRESETS.find((p) => p.id === presetId) ?? WINDOW_PRESETS[0];
  const [from, to] = preset.range(today.startOf('day'));
  return { from: from ? from.format(ISO) : null, to: to.format(ISO) };
}

/** e.g. "1 July 2025 to 30 June 2026", or "All time, up to 27 November 2026". */
export function describeWindow(win) {
  if (!win) return '';
  const long = (ymd) => dayjs(ymd).format('D MMMM YYYY');
  return win.from ? `${long(win.from)} to ${long(win.to)}` : `All time, up to ${long(win.to)}`;
}

/**
 * Months only, short enough to sit under a bar: "Jul 26 – Jun 27", "Nov 26" for a window inside
 * one month, "All time" for an open start.
 */
export function describeWindowMonths(win) {
  if (!win) return '';
  if (!win.from) return 'All time';
  const a = dayjs(win.from).format('MMM YY');
  const b = dayjs(win.to).format('MMM YY');
  return a === b ? a : `${a} – ${b}`;
}

/** A sentence for the PDF's header, e.g. "Deals created 1 July 2025 to 30 June 2026." */
export function describeWindowSentence(win) {
  if (!win) return '';
  const long = (ymd) => dayjs(ymd).format('D MMMM YYYY');
  return win.from
    ? `Deals created ${long(win.from)} to ${long(win.to)}.`
    : `Every deal created up to ${long(win.to)}.`;
}

/** The short form for a select and a file name, e.g. "1 Jul 2025 – 30 Jun 2026". */
export function describeWindowShort(win) {
  if (!win) return '';
  const short = (ymd) => dayjs(ymd).format('D MMM YYYY');
  return win.from ? `${short(win.from)} – ${short(win.to)}` : `All time – ${short(win.to)}`;
}

/** The browser's IANA zone, which decides where the server starts each day. */
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
