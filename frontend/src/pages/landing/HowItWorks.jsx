const EXT    = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_SM = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET_SM= 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const STEPS = [
  {
    n: '01',
    role: 'Broker',
    roleColor: '#6C63FF',
    roleBg: 'rgba(108,99,255,0.1)',
    title: 'Open a deal',
    body: 'Pick the firm and branch, capture the property and client, attach the IDs the seller hands over.',
  },
  {
    n: '02',
    role: 'Broker',
    roleColor: '#6C63FF',
    roleBg: 'rgba(108,99,255,0.1)',
    title: 'Submit for review',
    body: 'Hand-off in one click. The deal moves out of the broker workspace and into the compliance queue.',
  },
  {
    n: '03',
    role: 'Compliance',
    roleColor: '#38B2AC',
    roleBg: 'rgba(56,178,172,0.1)',
    title: 'Verify the structure',
    body: 'Claim the deal, build the ownership tree, run LINZ / NZBN / IDV checks, attach documents as needed.',
  },
  {
    n: '04',
    role: 'Manager',
    roleColor: '#3D4852',
    roleBg: 'rgba(61,72,82,0.08)',
    title: 'Decide with confidence',
    body: 'Approve, reject, or override — with notes attached. Decision is broadcast back to the broker and firm.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="mb-16 max-w-xl">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-neu-muted mb-3">
            The lifecycle
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-neu-fg sm:text-4xl">
            Draft. Submit. Review. Decide.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-neu-muted">
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
                <div
                  className="absolute top-8 left-full z-10 hidden w-6 -translate-x-3 lg:block"
                  aria-hidden="true"
                >
                  <div className="h-px border-t-2 border-dashed" style={{ borderColor: 'rgba(108,99,255,0.2)' }} />
                </div>
              )}

              <div
                className="h-full rounded-[28px] p-6 transition duration-300 ease-out hover:-translate-y-0.5"
                style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
              >
                {/* Number circle */}
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold"
                    style={{ backgroundColor: '#E0E5EC', boxShadow: EXT_SM, color: '#6C63FF' }}
                  >
                    {s.n}
                  </div>
                  {/* Role badge */}
                  <span
                    className="rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: s.roleBg, color: s.roleColor, boxShadow: INSET_SM }}
                  >
                    {s.role}
                  </span>
                </div>

                <h3 className="font-display text-[1rem] font-bold leading-snug text-neu-fg mb-2">
                  {s.title}
                </h3>
                <p className="text-[0.85rem] leading-relaxed text-neu-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
