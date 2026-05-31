const STEPS = [
  {
    n: '01',
    role: 'Broker',
    title: 'Open a deal',
    body: 'Pick the firm and branch, capture the property and client, attach the IDs the seller hands over.',
  },
  {
    n: '02',
    role: 'Broker',
    title: 'Submit for review',
    body: 'Hand-off in one click. The deal moves out of the broker workspace and into the compliance queue.',
  },
  {
    n: '03',
    role: 'Compliance',
    title: 'Verify the structure',
    body: 'Claim the deal, build the ownership tree, run LINZ / NZBN / IDV checks, attach more documents if needed.',
  },
  {
    n: '04',
    role: 'Manager',
    title: 'Decide with confidence',
    body: 'Approve, reject, or override — with notes attached. The decision is broadcast back to the broker and the firm.',
  },
];

const ROLE_TINT = {
  Broker: 'bg-trust-100 text-trust-800',
  Compliance: 'bg-warm-100 text-amber-800',
  Manager: 'bg-emerald-100 text-emerald-800',
};

export function HowItWorks() {
  return (
    <section id="how" className="mt-28 border-t border-trust-100 bg-white/60 py-24 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-trust-500">
            The lifecycle
          </p>
          <h2 className="mt-3 font-baskerville text-3xl font-bold text-trust-900 sm:text-4xl">
            Draft. Submit. Review. Decide.
          </h2>
          <p className="mt-3 font-baskerville text-lg text-trust-700">
            Each role moves the deal exactly one notch forward. No emails, no spreadsheets,
            no "Where did you save the trust deed?"
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" style={{listStyleType:'none', margin:0, padding:0}}>
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="relative rounded-2xl border border-trust-100 bg-white p-6 shadow-sm shadow-trust-900/5"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-baskerville text-3xl font-bold text-trust-500/80">{s.n}</span>
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-widest',
                    ROLE_TINT[s.role] ?? 'bg-trust-100 text-trust-800',
                  ].join(' ')}
                >
                  {s.role}
                </span>
              </div>
              <h3 className="mt-4 font-baskerville text-xl font-bold text-trust-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-trust-700">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
