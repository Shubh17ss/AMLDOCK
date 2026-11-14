// ── "Clearance" tokens for the public site ────────────────────────────────
// Mirrors src/theme/theme.js so the marketing pages read as the same product as
// the app. Hex values rather than the theme's var() tokens: the public site never
// goes dark, and the dashboard's data-theme attribute must not reach it.
export const CLR = {
  canvas:    '#FFFFFF',
  ink:       '#111111',
  muted:     '#5A6576',
  blue:      '#1B5FE3',
  blueDark:  '#1648B0',
  blueWash:  '#EAF1FE',
  hairline:  '#E7ECF3',
  hairline2: '#D7DEEA',
  // Deal-status semantics — used only inside the product mock-ups.
  approved:     '#15803D',
  approvedWash: '#E6F4EC',
  review:       '#B45309',
  reviewWash:   '#FEF3E2',
};

export const FONT = {
  display: '"FK Grotesk Trial", "Plus Jakarta Sans", system-ui, sans-serif',
  body:    '"DM Sans", system-ui, -apple-system, sans-serif',
  mono:    '"FK Grotesk Mono Trial", ui-monospace, "SFMono-Regular", monospace',
};

/** The one easing the site moves on: fast off the mark, long settle. */
export const EASE = [0.22, 1, 0.36, 1];
