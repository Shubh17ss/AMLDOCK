export function Check({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Chevron({ flip }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
      <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Node glyphs for the ownership tree: trust, company, person. */
export function NodeGlyph({ kind }) {
  if (kind === 'trust') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 1.5l4 2v2.8c0 2.2-1.7 3.8-4 4.4-2.3-.6-4-2.2-4-4.4V3.5l4-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'company') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.5 10.5v-8h4.5v8M7 5h2.5v5.5M1.5 10.5h9M4.2 4.5h1M4.2 6.5h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 10.5c.4-2 1.9-3 3.8-3s3.4 1 3.8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
