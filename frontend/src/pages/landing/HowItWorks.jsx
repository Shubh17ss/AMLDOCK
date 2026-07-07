import { useEffect, useRef, useState } from 'react';
import { CLR } from './clr.js';
import { Reveal, usePrefersReducedMotion } from './reveal.jsx';

const AUTOPLAY_MS = 6500;

const STEPS = [
  {
    n: '01',
    role: 'Broker',
    roleColor: CLR.blue,
    roleBg: CLR.blueWash,
    title: 'Open a deal',
    body: 'Start where the transaction does. Capture the property, the client, and the identity documents the seller hands over.',
    user: ['Pick the firm and branch', 'Capture the property and client', 'Attach the seller’s IDs'],
    auto: ['Assigns a unique deal reference', 'Pre-fills firm and branch context', 'Saves a draft as you type'],
  },
  {
    n: '02',
    role: 'Broker',
    roleColor: CLR.blue,
    roleBg: CLR.blueWash,
    title: 'Submit for review',
    body: 'Hand the deal off in a single click. It leaves the broker workspace and enters the compliance queue, cleanly.',
    user: ['Give the draft a final look', 'Submit for review'],
    auto: ['Routes the deal to the compliance queue', 'Notifies the compliance officer', 'Locks the broker copy from edits'],
  },
  {
    n: '03',
    role: 'Compliance',
    roleColor: CLR.approved,
    roleBg: '#E6F4EC',
    title: 'Verify the structure',
    body: 'Build the ownership picture and let the checks run. You confirm the people; AMLDOCK does the look-ups.',
    user: ['Build the ownership tree', 'Attach supporting documents', 'Confirm the beneficial owners'],
    auto: ['Runs LINZ title look-ups', 'Matches entities against NZBN', 'Flags gaps and unverified nodes'],
  },
  {
    n: '04',
    role: 'Manager',
    roleColor: CLR.ink,
    roleBg: '#EEF1F6',
    title: 'Decide with confidence',
    body: 'Make the call with the whole file in front of you. Every decision is recorded the moment it’s made.',
    user: ['Approve, reject, or override', 'Add a decision note'],
    auto: ['Writes an immutable audit record', 'Broadcasts the outcome to broker and firm', 'Stamps the actor, time, and IP'],
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = usePrefersReducedMotion();
  const count = STEPS.length;

  const go = (i) => setActive(((i % count) + count) % count);
  const next = () => go(active + 1);
  const prev = () => go(active - 1);

  // Gentle autoplay — pauses on hover/focus and when reduced motion is requested.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (paused || reduce) return undefined;
    const id = setInterval(() => setActive((a) => (a + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, reduce, count]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
  };

  return (
    <section id="how" className="py-24 md:py-28" style={{ borderTop: `1px solid ${CLR.hairline}` }}>
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <Reveal className="mb-10 max-w-xl">
          <p className="clr-eyebrow inline-flex items-center gap-2 mb-4">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLR.blue }} />
            The lifecycle
          </p>
          <h2 className="font-grotesk text-3xl font-extrabold sm:text-4xl" style={{ color: CLR.ink, letterSpacing: '-0.03em' }}>
            One deal, four moves.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed" style={{ color: CLR.muted }}>
            Each role moves the deal exactly one notch forward — and at every step, you stay in control
            of the judgement calls while AMLDOCK handles the busywork.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div
            role="group"
            aria-roledescription="carousel"
            aria-label="How AMLDOCK works, step by step"
            onKeyDown={onKeyDown}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            {/* Stepper rail — the whole sequence, doubles as navigation */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
              {STEPS.map((s, i) => {
                const done = i <= active;
                return (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Go to step ${i + 1}: ${s.title}`}
                    aria-current={i === active ? 'step' : undefined}
                    className="group text-left clr-focus rounded-lg"
                  >
                    <span
                      className="block h-1 rounded-full transition-colors duration-300"
                      style={{ backgroundColor: done ? CLR.blue : CLR.hairline2 }}
                    />
                    <span className="mt-2.5 flex items-baseline gap-1.5">
                      <span
                        className="font-bold transition-colors duration-300"
                        style={{
                          fontFamily: '"FK Grotesk Mono Trial", monospace',
                          fontSize: '0.95rem',
                          color: i === active ? CLR.blue : CLR.muted,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {s.n}
                      </span>
                      <span
                        className="truncate text-[0.72rem] font-semibold uppercase tracking-wide transition-colors duration-300"
                        style={{ color: i === active ? CLR.ink : CLR.muted }}
                      >
                        {s.role}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Slide viewport */}
            <div className="overflow-hidden rounded-3xl">
              <div
                className="flex"
                style={{
                  transform: `translateX(-${active * 100}%)`,
                  transition: reduce ? 'none' : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {STEPS.map((s, i) => (
                  <div key={s.n} className="w-full flex-shrink-0" aria-hidden={i !== active}>
                    <Slide step={s} />
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-between">
              <span
                className="text-[0.8rem] font-semibold"
                style={{ fontFamily: '"FK Grotesk Mono Trial", monospace', color: CLR.muted, letterSpacing: '0.04em' }}
                aria-live="polite"
              >
                STEP {STEPS[active].n} / {String(count).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                <ArrowBtn dir="prev" onClick={prev} />
                <ArrowBtn dir="next" onClick={next} />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Slide({ step }) {
  return (
    <article className="clr-card rounded-3xl p-7 md:p-9">
      <div className="grid gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-center">
        {/* Left — the step */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span
              className="font-bold leading-none"
              style={{ fontFamily: '"FK Grotesk Mono Trial", monospace', fontSize: '3rem', color: CLR.blue, letterSpacing: '-0.03em' }}
            >
              {step.n}
            </span>
            <span
              className="rounded-md px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider"
              style={{ backgroundColor: step.roleBg, color: step.roleColor }}
            >
              {step.role}
            </span>
          </div>
          <h3 className="font-grotesk text-2xl font-bold leading-tight mb-2.5" style={{ color: CLR.ink, letterSpacing: '-0.02em' }}>
            {step.title}
          </h3>
          <p className="text-[0.95rem] leading-relaxed" style={{ color: CLR.muted }}>{step.body}</p>
        </div>

        {/* Right — the split: human vs automated */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionPanel kind="user" items={step.user} />
          <ActionPanel kind="auto" items={step.auto} />
        </div>
      </div>
    </article>
  );
}

function ActionPanel({ kind, items }) {
  const isAuto = kind === 'auto';
  return (
    <div
      className="rounded-2xl p-4"
      style={
        isAuto
          ? { backgroundColor: CLR.blueWash, border: `1px solid ${CLR.hairline}` }
          : { backgroundColor: '#fff', border: `1px solid ${CLR.hairline2}` }
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ backgroundColor: isAuto ? CLR.blue : '#EEF1F6' }}
        >
          {isAuto ? <BoltIcon /> : <CursorIcon />}
        </span>
        <span
          className="text-[0.64rem] font-bold uppercase tracking-[0.12em]"
          style={{ fontFamily: '"FK Grotesk Mono Trial", monospace', color: isAuto ? CLR.blueDark : CLR.ink }}
        >
          {isAuto ? 'AMLDOCK automates' : 'You control'}
        </span>
      </div>
      <ul className="list-none p-0 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[0.82rem]" style={{ color: isAuto ? CLR.blueDark : CLR.muted }}>
            {isAuto ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                <circle cx="7" cy="7" r="2.4" fill={CLR.blue} />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                <path d="M3 7l2.5 2.5L11 4" stroke={CLR.blue} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArrowBtn({ dir, onClick }) {
  const isNext = dir === 'next';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isNext ? 'Next step' : 'Previous step'}
      className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 clr-focus"
      style={{ backgroundColor: '#fff', border: `1px solid ${CLR.hairline2}`, color: CLR.ink }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = CLR.blue; e.currentTarget.style.backgroundColor = CLR.blueWash; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = CLR.hairline2; e.currentTarget.style.backgroundColor = '#fff'; }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ transform: isNext ? 'none' : 'scaleX(-1)' }}>
        <path d="M6 3.5L11.5 9L6 14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function BoltIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7.5 1.5L3 8h3.2l-.7 4.5L11 6H7.8l-.3-4.5z" fill="#fff" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M3 2.2l7.5 4.4-3.1.9-1.4 3.1L3 2.2z" fill="none" stroke={CLR.muted} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
