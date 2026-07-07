// ── "Clearance" tokens for the marketing surface ──────────────────────────
// Mirrors src/theme/theme.js so the landing / contact / pricing pages read as the
// same product as the app (/dashboard, /admin). White canvas, blue primary, ink
// text, FK Grotesk display + DM Sans body + FK Grotesk Mono "ledger" voice,
// soft single-source shadows over 1px hairlines — no neumorphism.
export const CLR = {
  canvas:    '#FFFFFF',
  tile:      '#FFFFFF',
  ink:       '#111111',
  muted:     '#5A6576',
  blue:      '#1B5FE3',
  blueDark:  '#1648B0',
  blueWash:  '#EAF1FE',
  hairline:  '#E7ECF3',
  hairline2: '#D7DEEA',
  // Deal-status semantics — used only inside the product mockup so it reads as the real app.
  approved:     '#15803D',
  approvedWash: '#E6F4EC',
  review:       '#B45309',
  reviewWash:   '#FEF3E2',
};

// Apple-style soft elevation (single light source) — copied from theme.js `shadows`.
export const SH = {
  sm:    '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)',
  md:    '0 1px 3px rgba(16,24,40,0.07), 0 8px 24px rgba(16,24,40,0.09)',
  lg:    '0 4px 10px rgba(16,24,40,0.09), 0 20px 48px rgba(16,24,40,0.15)',
  focus: '0 0 0 3px rgba(27,95,227,0.22)',
};

// Font stacks (match theme.js `fonts`).
export const FONT = {
  display: '"FK Grotesk Trial", "Plus Jakarta Sans", system-ui, sans-serif',
  body:    '"DM Sans", system-ui, -apple-system, sans-serif',
  mono:    '"FK Grotesk Mono Trial", ui-monospace, "SFMono-Regular", monospace',
};
