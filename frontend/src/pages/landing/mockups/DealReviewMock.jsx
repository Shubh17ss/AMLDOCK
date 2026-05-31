import { BrowserFrame } from './BrowserFrame.jsx';

/**
 * Hero-side mockup: a single deal under review with a compact ownership tree
 * snapshot. Every value is stylistic — no real data.
 */
export function DealReviewMock() {
  return (
    <BrowserFrame label="amldock.app/deals/DEAL-2026-0142/review">
      <div className="p-5">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-trust-500">
              Compliance review
            </div>
            <div className="mt-0.5 truncate text-lg font-bold text-trust-900">DEAL-2026-0142</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-100 px-2 py-1 text-[0.68rem] font-semibold text-amber-800">
              UNDER REVIEW
            </span>
            <span className="rounded-md bg-trust-100 px-2 py-1 text-[0.68rem] font-semibold text-trust-700">
              PURCHASE · NZD 1.85M
            </span>
          </div>
        </div>

        {/* Summary strip */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-trust-50 p-3 text-[0.72rem] text-trust-700">
          <SummaryCell label="Firm" value="Bayleys Wellington" />
          <SummaryCell label="Branch" value="Te Aro" />
          <SummaryCell label="Client" value="Smith Family Trust" />
        </div>

        {/* Tree */}
        <div className="mt-4 rounded-xl border border-trust-100 p-3 text-[0.78rem] text-trust-800">
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-trust-500">
            Ownership structure
          </div>
          <TreeRow icon="trust" name="Smith Family Trust" badge="root" />
          <TreeRow icon="person" name="John Smith" indent={1} role="Trustee" />
          <TreeRow icon="person" name="Jane Smith" indent={1} role="Trustee" verified />
          <TreeRow icon="company" name="Smith Holdings Ltd" indent={1} role="Beneficiary · 60%" />
          <TreeRow icon="person" name="Olivia Smith" indent={2} role="Director · 100%" />
        </div>

        {/* Footer chips */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[0.7rem] text-trust-500">
            <Dot tone="emerald" /> LINZ title verified
            <span className="text-trust-200">·</span>
            <Dot tone="emerald" /> NZBN matched
          </div>
          <div className="flex gap-2">
            <span className="rounded-[0.7rem] bg-emerald-600 px-3 py-1 text-[0.7rem] font-semibold text-white">
              Approve
            </span>
            <span className="rounded-[0.7rem] ring-1 ring-rose-300 px-3 py-1 text-[0.7rem] font-semibold text-rose-700">
              Reject
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function SummaryCell({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.62rem] uppercase tracking-widest text-trust-500">{label}</div>
      <div className="truncate font-semibold text-trust-900">{value}</div>
    </div>
  );
}

function Dot({ tone = 'emerald' }) {
  const cls = tone === 'emerald' ? 'bg-emerald-500' : 'bg-trust-500';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

function TreeRow({ icon, name, indent = 0, badge, role, verified }) {
  return (
    <div className="flex items-center gap-2 py-1" style={{ paddingLeft: indent * 18 }}>
      {indent > 0 && <span className="text-trust-300">└</span>}
      <NodeIcon kind={icon} />
      <span className="truncate font-medium text-trust-900">{name}</span>
      {badge && (
        <span className="rounded-md bg-trust-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-trust-700">
          {badge}
        </span>
      )}
      {role && <span className="text-trust-500">{role}</span>}
      {verified && (
        <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[0.6rem] font-semibold text-emerald-700">
          Verified
        </span>
      )}
    </div>
  );
}

function NodeIcon({ kind }) {
  const base = 'grid h-5 w-5 place-items-center rounded-md text-[0.62rem] font-bold';
  if (kind === 'trust') return <span className={`${base} bg-trust-100 text-trust-700`}>★</span>;
  if (kind === 'person') return <span className={`${base} bg-trust-50 text-trust-700 ring-1 ring-trust-100`}>P</span>;
  if (kind === 'company') return <span className={`${base} bg-warm-50 text-amber-700 ring-1 ring-warm-100`}>C</span>;
  return <span className={`${base} bg-trust-50 text-trust-700`}>·</span>;
}
