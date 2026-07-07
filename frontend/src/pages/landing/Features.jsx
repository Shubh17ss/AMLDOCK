import { CLR } from './clr.js';
import { Reveal } from './reveal.jsx';

const FEATURES = [
  {
    eyebrow: 'Ownership',
    title: 'Map complex structures in minutes',
    desc: 'Build the ownership tree that actually reflects the deal — trusts, companies, natural persons — with percentages and roles on every edge. Cycle detection and validation come standard.',
    bullets: ['Natural persons, NZ companies, trusts', 'Trustee / beneficiary / shareholder edges', 'Cycle & percentage validation on save'],
    icon: <OwnershipIcon />,
  },
  {
    eyebrow: 'Evidence',
    title: 'Every document exactly where it belongs',
    desc: 'Passports, trust deeds, sale agreements — uploaded once, attached to the right node, reviewable side-by-side with the ownership tree. S3-backed, presigned URLs, no proxying.',
    bullets: ['Deal-level and per-node attachments', 'PDF + image preview side-by-side', 'Short-lived presigned downloads only'],
    icon: <EvidenceIcon />,
  },
  {
    eyebrow: 'Decisions',
    title: 'Approvals that stand up to scrutiny',
    desc: 'Every approve, reject, and override is captured in an immutable record — with actor, IP, before/after, and decision notes. Manager override is one click, always justified.',
    bullets: ['Per-deal audit panel + admin-wide search', 'Approve / Reject / Override with notes', 'Filter by actor, action, entity, date'],
    icon: <DecisionsIcon />,
  },
];

export function Features() {
  return (
    <section id="product" className="py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <Reveal className="text-center mb-14">
          <p className="clr-eyebrow inline-flex items-center gap-2 mb-4">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLR.blue }} />
            The platform
          </p>
          <h2 className="font-grotesk text-3xl font-extrabold sm:text-4xl" style={{ color: CLR.ink, letterSpacing: '-0.03em' }}>
            Three jobs. One quiet workspace.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[1.02rem] leading-relaxed" style={{ color: CLR.muted }}>
            Brokers prepare. Compliance officers verify. Managers decide. AMLDOCK keeps everyone
            on the same page — literally.
          </p>
        </Reveal>

        {/* Feature cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 100} className="h-full">
              <FeatureCard {...f} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ eyebrow, title, desc, bullets, icon }) {
  return (
    <div className="clr-card clr-lift group h-full rounded-3xl p-7">
      {/* Icon well */}
      <div
        className="mb-6 flex items-center justify-center rounded-2xl"
        style={{ height: 52, width: 52, backgroundColor: CLR.blueWash }}
      >
        {icon}
      </div>

      {/* Ledger eyebrow */}
      <p className="clr-eyebrow mb-2.5" style={{ color: CLR.blue }}>{eyebrow}</p>

      {/* Title */}
      <h3 className="font-grotesk text-[1.15rem] font-bold leading-snug mb-3" style={{ color: CLR.ink, letterSpacing: '-0.015em' }}>
        {title}
      </h3>

      {/* Description */}
      <p className="text-[0.9rem] leading-relaxed mb-5" style={{ color: CLR.muted }}>{desc}</p>

      {/* Bullets */}
      <ul className="list-none p-0 space-y-2.5" style={{ borderTop: `1px solid ${CLR.hairline}`, paddingTop: 18 }}>
        {bullets.map(b => (
          <li key={b} className="flex items-start gap-2.5 text-[0.83rem]" style={{ color: CLR.muted }}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
              <circle cx="7" cy="7" r="6.5" fill={CLR.blueWash} />
              <path d="M4 7l2 2 4-4" stroke={CLR.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OwnershipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="3.5" r="2" stroke={CLR.blue} strokeWidth="1.4" />
      <circle cx="3.5" cy="13.5" r="2" stroke={CLR.blue} strokeWidth="1.4" />
      <circle cx="14.5" cy="13.5" r="2" stroke={CLR.blue} strokeWidth="1.4" />
      <path d="M9 5.5v3M9 8.5L3.5 11.5M9 8.5L14.5 11.5" stroke={CLR.blue} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="2" width="10" height="13" rx="2" stroke={CLR.blue} strokeWidth="1.4" />
      <path d="M6 6h4M6 9h4M6 12h2" stroke={CLR.blue} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="10" y="8" width="5" height="7" rx="1.5" fill="#fff" stroke={CLR.blue} strokeWidth="1.2" />
    </svg>
  );
}

function DecisionsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L3 5V9.5C3 12.93 5.69 16.11 9 17C12.31 16.11 15 12.93 15 9.5V5L9 2Z"
        stroke={CLR.blue} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 9l2 2 4-4" stroke={CLR.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
