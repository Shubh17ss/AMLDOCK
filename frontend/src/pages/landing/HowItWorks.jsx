import { CLR } from './clr.js';

const STEPS = [
  {
    n: '01',
    role: 'Broker',
    roleColor: CLR.blue,
    roleBg: CLR.blueWash,
    title: 'Open a deal',
    body: 'Pick the firm and branch, capture the property and client, attach the IDs the seller hands over.',
  },
  {
    n: '02',
    role: 'Broker',
    roleColor: CLR.blue,
    roleBg: CLR.blueWash,
    title: 'Submit for review',
    body: 'Hand-off in one click. The deal moves out of the broker workspace and into the compliance queue.',
  },
  {
    n: '03',
    role: 'Compliance',
    roleColor: CLR.approved,
    roleBg: '#E6F4EC',
    title: 'Verify the structure',
    body: 'Claim the deal, build the ownership tree, run LINZ / NZBN / IDV checks, attach documents as needed.',
  },
  {
    n: '04',
    role: 'Manager',
    roleColor: CLR.ink,
    roleBg: '#EEF1F6',
    title: 'Decide with confidence',
    body: 'Approve, reject, or override — with notes attached. Decision is broadcast back to the broker and firm.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24 md:py-28" style={{ borderTop: `1px solid ${CLR.hairline}` }}>
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="mb-14 max-w-xl">
          <p className="clr-eyebrow inline-flex items-center gap-2 mb-4">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLR.blue }} />
            The lifecycle
          </p>
          <h2 className="font-grotesk text-3xl font-extrabold sm:text-4xl" style={{ color: CLR.ink, letterSpacing: '-0.03em' }}>
            Draft. Submit. Review. Decide.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed" style={{ color: CLR.muted }}>
            Each role moves the deal exactly one notch forward. No emails, no spreadsheets,
            no "Where did you save the trust deed?"
          </p>
        </div>

        {/* Steps grid */}
        <ol className="relative list-none grid gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative">
              {/* Desktop connector */}
              {i < STEPS.length - 1 && (
                <div className="absolute top-10 left-full z-0 hidden w-6 lg:block" aria-hidden="true">
                  <div className="mx-1.5 h-px border-t-2 border-dashed" style={{ borderColor: CLR.hairline2 }} />
                </div>
              )}

              <div className="clr-card clr-lift h-full rounded-3xl p-6">
                {/* Oversized ledger numeral */}
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="font-bold leading-none"
                    style={{ fontFamily: '"FK Grotesk Mono Trial", monospace', fontSize: '2.4rem', color: CLR.blue, letterSpacing: '-0.02em' }}
                  >
                    {s.n}
                  </span>
                  {/* Role badge */}
                  <span
                    className="rounded-md px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: s.roleBg, color: s.roleColor }}
                  >
                    {s.role}
                  </span>
                </div>

                <h3 className="font-grotesk text-[1.05rem] font-bold leading-snug mb-2" style={{ color: CLR.ink, letterSpacing: '-0.01em' }}>
                  {s.title}
                </h3>
                <p className="text-[0.85rem] leading-relaxed" style={{ color: CLR.muted }}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
