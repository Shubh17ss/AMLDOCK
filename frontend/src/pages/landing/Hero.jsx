import { Link as RouterLink } from 'react-router-dom';
import { CLR, SH } from './clr.js';

export function Hero({ isAuthed, dashboardHref }) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* Faint audit-grid + blue glow — depth on white, no neumorphism */}
      <div className="clr-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full"
        aria-hidden="true"
        style={{ background: 'radial-gradient(circle, rgba(27,95,227,0.10) 0%, transparent 68%)' }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">

          {/* ── Copy ── */}
          <div>
            {/* Ledger eyebrow */}
            <div
              className="clr-rise clr-eyebrow inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: CLR.blueWash, color: CLR.blueDark }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: CLR.blue }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: CLR.blue }} />
              </span>
              NZ AML/CFT · Built for real estate
            </div>

            {/* Headline */}
            <h1
              className="clr-rise clr-d1 mt-6 font-grotesk font-extrabold tracking-tight"
              style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.4rem)', lineHeight: 1.04, letterSpacing: '-0.035em', color: CLR.ink }}
            >
              AML compliance,
              <br />
              <span style={{ color: CLR.blue }}>finally at ease.</span>
            </h1>

            {/* Subheading */}
            <p className="clr-rise clr-d2 mt-5 max-w-[30rem] text-[1.05rem] leading-relaxed" style={{ color: CLR.muted }}>
              AMLDOCK guides brokers, compliance officers and managers through every deal —
              from first draft to final decision — on a single, auditable platform.
            </p>

            {/* CTAs */}
            <div className="clr-rise clr-d3 mt-8 flex flex-wrap items-center gap-3">
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
            <div className="clr-rise clr-d4 mt-9 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {['LINZ title look-up', 'NZBN matching', 'DIA-aligned IDV', 'Immutable audit'].map(chip => (
                <span key={chip} className="inline-flex items-center gap-1.5 text-[0.8rem]" style={{ color: CLR.muted }}>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke={CLR.blue} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* ── Product tile ── */}
          <div className="clr-rise clr-d3 relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="clr-float">
              <DealTile />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ── Hero CTA Button ─────────────────────────────────────────────────── */
function HeroBtn({ primary, as: Tag = 'button', to, href, children }) {
  const props = to ? { to } : href ? { href } : {};
  const base = 'inline-flex items-center justify-center rounded-xl px-6 py-3 text-[0.92rem] font-semibold transition-all duration-200 clr-focus';
  if (primary) {
    return (
      <Tag {...props} className={`${base} text-white`}
        style={{ backgroundColor: CLR.blue, boxShadow: SH.sm }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = CLR.blueDark; e.currentTarget.style.boxShadow = SH.md; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = CLR.blue; e.currentTarget.style.boxShadow = SH.sm; e.currentTarget.style.transform = 'none'; }}
      >
        {children}
      </Tag>
    );
  }
  return (
    <Tag {...props} className={base}
      style={{ backgroundColor: '#fff', color: CLR.ink, border: `1px solid ${CLR.hairline2}` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = CLR.blue; e.currentTarget.style.backgroundColor = CLR.blueWash; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = CLR.hairline2; e.currentTarget.style.backgroundColor = '#fff'; }}
    >
      {children}
    </Tag>
  );
}

/* ── Clearance Deal Review tile — mirrors the real app ───────────────── */
function DealTile() {
  return (
    <div className="clr-card rounded-3xl p-6" style={{ boxShadow: SH.lg }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="clr-eyebrow mb-1.5" style={{ fontSize: '0.62rem' }}>Compliance Review</p>
          <h3 className="text-lg font-bold" style={{ color: CLR.ink, fontFamily: '"FK Grotesk Mono Trial", monospace', letterSpacing: '-0.01em' }}>
            DEAL-2026-0142
          </h3>
          <p className="text-[0.8rem] mt-0.5" style={{ color: CLR.muted }}>Bayleys Wellington · NZD 1.85M</p>
        </div>
        <span
          className="shrink-0 rounded-lg px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-wide"
          style={{ backgroundColor: CLR.reviewWash, color: CLR.review }}
        >
          Under Review
        </span>
      </div>

      {/* Summary well */}
      <div
        className="rounded-2xl p-4 mb-3.5 grid grid-cols-3 gap-3"
        style={{ backgroundColor: '#FBFCFE', border: `1px solid ${CLR.hairline}` }}
      >
        <SummaryCell label="Client"   value="Smith Family Trust" />
        <SummaryCell label="Branch"   value="Te Aro" />
        <SummaryCell label="Verified" value="3 of 4" accent />
      </div>

      {/* Ownership tree */}
      <div className="rounded-2xl p-4 mb-4" style={{ border: `1px solid ${CLR.hairline}` }}>
        <p className="clr-eyebrow mb-3" style={{ fontSize: '0.6rem' }}>Ownership Structure</p>
        <TreeRow kind="trust"   name="Smith Family Trust" label="root" />
        <TreeRow kind="person"  name="John Smith"         role="Trustee"          indent verified />
        <TreeRow kind="person"  name="Jane Smith"         role="Trustee"          indent verified />
        <TreeRow kind="company" name="Smith Holdings Ltd" role="Beneficiary · 60%" indent />
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
      <p className="clr-eyebrow mb-1" style={{ fontSize: '0.55rem', letterSpacing: '0.12em' }}>{label}</p>
      <p className="text-[0.76rem] font-semibold truncate" style={{ color: accent ? CLR.approved : CLR.ink }}>
        {value}
      </p>
    </div>
  );
}

function TreeRow({ kind, name, label, role, indent, verified }) {
  const map = {
    trust:   { bg: CLR.blueWash, fg: CLR.blue,     icon: '★' },
    company: { bg: '#E6F4EC',    fg: CLR.approved, icon: 'C' },
    person:  { bg: '#EEF1F6',    fg: CLR.muted,    icon: 'P' },
  }[kind];
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: indent ? 18 : 0 }}>
      {indent && <span style={{ color: CLR.hairline2, fontSize: '0.7rem' }}>└</span>}
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[0.55rem] font-bold"
        style={{ backgroundColor: map.bg, color: map.fg }}
      >
        {map.icon}
      </span>
      <span className="truncate text-[0.72rem] font-medium" style={{ color: CLR.ink }}>{name}</span>
      {label && (
        <span
          className="rounded px-1.5 py-0.5 text-[0.53rem] font-bold uppercase tracking-wider"
          style={{ backgroundColor: '#EEF1F6', color: CLR.muted, fontFamily: '"FK Grotesk Mono Trial", monospace' }}
        >
          {label}
        </span>
      )}
      {role && <span className="text-[0.7rem]" style={{ color: CLR.muted }}>{role}</span>}
      {verified && <span className="text-[0.62rem] font-bold" style={{ color: CLR.approved }}>✓</span>}
    </div>
  );
}

function VerifyChip({ ok, children }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[0.62rem] font-bold"
      style={{
        backgroundColor: ok ? '#E6F4EC' : '#EEF1F6',
        color: ok ? CLR.approved : CLR.muted,
        fontFamily: '"FK Grotesk Mono Trial", monospace',
      }}
    >
      {ok ? '✓ ' : '· '}{children}
    </span>
  );
}

function ActionBtn({ primary, children }) {
  return (
    <span
      className="cursor-default rounded-lg px-3 py-1.5 text-[0.68rem] font-bold"
      style={
        primary
          ? { backgroundColor: CLR.blue, color: '#fff', boxShadow: SH.sm }
          : { backgroundColor: '#fff', color: CLR.muted, border: `1px solid ${CLR.hairline2}` }
      }
    >
      {children}
    </span>
  );
}
