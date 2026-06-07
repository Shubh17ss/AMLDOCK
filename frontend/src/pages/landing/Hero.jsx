import { Link as RouterLink } from 'react-router-dom';

const EXT    = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_SM = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET  = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';
const INSET_D= 'inset 10px 10px 20px rgb(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)';
const INSET_SM='inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

export function Hero({ isAuthed, dashboardHref }) {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      {/* Decorative concentric circles — top right */}
      <ConcentricCircles className="absolute -top-24 -right-24 opacity-60" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">

          {/* ── Copy ── */}
          <div>
            {/* Badge */}
            <div
              className="neu-fade-up inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-neu-muted"
              style={{ backgroundColor: '#E0E5EC', boxShadow: INSET_SM }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: '#38B2AC' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: '#38B2AC' }} />
              </span>
              NZ AML/CFT · Built for real estate
            </div>

            {/* Headline */}
            <h1
              className="neu-fade-up neu-delay-1 mt-6 font-display font-extrabold tracking-tight text-neu-fg"
              style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.5rem)', lineHeight: 1.05 }}
            >
              AML compliance,
              <br />
              <span style={{ color: '#0764a7' }}>finally at ease.</span>
            </h1>

            {/* Subheading */}
            <p className="neu-fade-up neu-delay-2 mt-5 max-w-[30rem] text-[1.05rem] leading-relaxed text-neu-muted">
              AMLDOCK guides brokers, compliance officers and managers through every deal —
              from first draft to final decision — on a single, auditable platform.
            </p>

            {/* CTAs */}
            <div className="neu-fade-up neu-delay-3 mt-8 flex flex-wrap items-center gap-3">
              {isAuthed ? (
                <HeroBtn primary as={RouterLink} to={dashboardHref}>Open dashboard →</HeroBtn>
              ) : (
                <>
                  <HeroBtn primary as={RouterLink} to="/login">Get started →</HeroBtn>
                  <HeroBtn as="a" href="#product">See the platform</HeroBtn>
                </>
              )}
            </div>

            {/* Trust chips */}
            <div className="neu-fade-up neu-delay-4 mt-8 flex flex-wrap items-center gap-4">
              {['LINZ title look-up', 'NZBN matching', 'DIA-aligned IDV', 'Immutable audit'].map(chip => (
                <span key={chip} className="inline-flex items-center gap-1.5 text-[0.78rem] text-neu-muted">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#38B2AC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* ── Mockup ── */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {/* Floating animation wrapper */}
            <div className="animate-float">
              <DealMockup />
            </div>
            {/* Decorative bottom-left circles */}
            <ConcentricCircles className="absolute -bottom-16 -left-16 opacity-40 scale-75" />
          </div>

        </div>
      </div>
    </section>
  );
}

/* ── Hero CTA Button ─────────────────────────────────────────────────── */
function HeroBtn({ primary, as: Tag = 'button', to, href, children }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
      className="inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-[0.9rem] font-bold transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-px neu-focus"
      style={primary
        ? { backgroundColor: '#0764a7', color: '#fff', boxShadow: EXT }
        : { backgroundColor: '#E0E5EC', color: '#3D4852', boxShadow: EXT }
      }
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
    >
      {children}
    </Tag>
  );
}

/* ── Neumorphic Deal Review Mockup ───────────────────────────────────── */
function DealMockup() {
  return (
    <div className="rounded-[32px] p-7" style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neu-muted mb-1">
            Compliance Review
          </p>
          <h3 className="font-display text-lg font-bold text-neu-fg">DEAL-2026-0142</h3>
          <p className="text-[0.8rem] text-neu-muted mt-0.5">Bayleys Wellington · NZD 1.85M</p>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1.5 text-[0.65rem] font-semibold text-amber-700"
          style={{ backgroundColor: '#E0E5EC', boxShadow: INSET_SM }}
        >
          Under Review
        </span>
      </div>

      {/* Summary well — inset */}
      <div className="rounded-2xl p-4 mb-4 grid grid-cols-3 gap-3" style={{ boxShadow: INSET_D }}>
        <SummaryCell label="Client"  value="Smith Family Trust" />
        <SummaryCell label="Branch"  value="Te Aro" />
        <SummaryCell label="Verified" value="3 of 4" accent />
      </div>

      {/* Ownership tree — inset */}
      <div className="rounded-2xl p-4 mb-4" style={{ boxShadow: INSET }}>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-neu-muted mb-3">
          Ownership Structure
        </p>
        <MockTreeRow kind="trust"   name="Smith Family Trust" label="root" />
        <MockTreeRow kind="person"  name="John Smith"         role="Trustee"          indent verified />
        <MockTreeRow kind="person"  name="Jane Smith"         role="Trustee"          indent verified />
        <MockTreeRow kind="company" name="Smith Holdings Ltd" role="Beneficiary · 60%" indent />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <VerifyChip ok>LINZ</VerifyChip>
          <VerifyChip ok>NZBN</VerifyChip>
          <VerifyChip>IDV</VerifyChip>
        </div>
        <div className="flex gap-2">
          <ActionBtn primary>Approve</ActionBtn>
          <ActionBtn>Reject</ActionBtn>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, accent }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.58rem] uppercase tracking-widest text-neu-muted mb-0.5">{label}</p>
      <p className="text-[0.75rem] font-semibold truncate" style={{ color: accent ? '#38B2AC' : '#3D4852' }}>
        {value}
      </p>
    </div>
  );
}

function MockTreeRow({ kind, name, label, role, indent, verified }) {
  const iconBg = kind === 'trust' ? '#ddd8ff' : kind === 'company' ? '#d1fae5' : '#e0e9f5';
  const iconFg = kind === 'trust' ? '#6C63FF' : kind === 'company' ? '#38B2AC' : '#3D4852';
  const icon   = kind === 'trust' ? '★' : kind === 'company' ? 'C' : 'P';
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: indent ? 18 : 0 }}>
      {indent && <span className="text-neu-muted/50 text-xs">└</span>}
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[0.55rem] font-bold"
        style={{ backgroundColor: iconBg, color: iconFg }}
      >
        {icon}
      </span>
      <span className="truncate text-[0.72rem] font-medium text-neu-fg">{name}</span>
      {label && (
        <span className="rounded-md px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-neu-muted" style={{ boxShadow: INSET_SM, backgroundColor: '#E0E5EC' }}>
          {label}
        </span>
      )}
      {role && <span className="text-[0.7rem] text-neu-muted">{role}</span>}
      {verified && (
        <span className="text-[0.6rem] font-semibold" style={{ color: '#38B2AC' }}>✓</span>
      )}
    </div>
  );
}

function VerifyChip({ ok, children }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold"
      style={{
        backgroundColor: '#E0E5EC',
        boxShadow: INSET_SM,
        color: ok ? '#38B2AC' : '#6B7280',
      }}
    >
      {ok ? '✓ ' : '⋯ '}{children}
    </span>
  );
}

function ActionBtn({ primary, children }) {
  return (
    <span
      className="cursor-pointer rounded-xl px-3 py-1.5 text-[0.68rem] font-bold transition duration-300"
      style={{
        backgroundColor: primary ? '#6C63FF' : '#E0E5EC',
        color: primary ? '#fff' : '#6B7280',
        boxShadow: EXT_SM,
      }}
    >
      {children}
    </span>
  );
}

/* ── Decorative concentric neumorphic circles ────────────────────────── */
function ConcentricCircles({ className = '' }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <div
        className="flex h-48 w-48 items-center justify-center rounded-full transition duration-500 ease-out hover:scale-105"
        style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}
      >
        <div
          className="flex h-32 w-32 items-center justify-center rounded-full"
          style={{ backgroundColor: '#E0E5EC', boxShadow: INSET }}
        >
          <div
            className="h-16 w-16 rounded-full"
            style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}
          />
        </div>
      </div>
    </div>
  );
}
