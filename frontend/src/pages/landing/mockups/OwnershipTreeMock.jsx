import { BrowserFrame } from './BrowserFrame.jsx';

export function OwnershipTreeMock() {
  return (
    <BrowserFrame label="amldock.app · ownership">
      <div className="grid grid-cols-12 gap-0">
        {/* Tree column */}
        <div className="col-span-7 border-r border-trust-100 p-5">
          <Header title="Ownership tree" subtitle="DEAL-2026-0142" />
          <div className="mt-3 space-y-0.5 text-[0.78rem]">
            <Row icon="trust" name="Smith Family Trust" badge="root" />
            <Row icon="person" indent={1} name="John Smith" role="Trustee" />
            <Row icon="person" indent={1} name="Jane Smith" role="Trustee" verified />
            <Row icon="company" indent={1} name="Smith Holdings Ltd" role="Beneficiary · 60%" />
            <Row icon="person" indent={2} name="Olivia Smith" role="Director · 100%" />
            <Row icon="person" indent={1} name="Henry Smith" role="Beneficiary · 40%" />
          </div>
          <button className="mt-4 inline-flex items-center gap-1.5 rounded-[0.7rem] bg-trust-50 px-3 py-1.5 text-[0.72rem] font-semibold text-trust-700 ring-1 ring-trust-100">
            <span className="text-base leading-none">+</span> Add child
          </button>
        </div>
        {/* Editor column */}
        <div className="col-span-5 p-5">
          <Header title="Smith Holdings Ltd" subtitle="NZ Company" small />
          <div className="mt-3 space-y-2 text-[0.76rem]">
            <Field label="NZBN" value="9429039000123" />
            <Field label="Company number" value="6128445" />
            <Field label="Incorporated" value="14 Jun 2018" />
            <Field label="Registered office" value="L4 / 22 Vivian St, Te Aro" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[0.66rem] font-semibold text-emerald-700">
              NZBN matched
            </span>
            <span className="rounded-md bg-trust-50 px-2 py-1 text-[0.66rem] font-semibold text-trust-700 ring-1 ring-trust-100">
              Director on file
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function Header({ title, subtitle, small }) {
  return (
    <div>
      <div className={`font-bold text-trust-900 ${small ? 'text-sm' : 'text-base'}`}>{title}</div>
      <div className="text-[0.65rem] uppercase tracking-widest text-trust-500">{subtitle}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-widest text-trust-500">{label}</div>
      <div className="font-medium text-trust-900">{value}</div>
    </div>
  );
}

function Row({ icon, indent = 0, name, role, badge, verified }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-trust-50" style={{ marginLeft: indent * 16 }}>
      {indent > 0 && <span className="text-trust-300">└</span>}
      <Icon kind={icon} />
      <span className="font-medium text-trust-900">{name}</span>
      {badge && (
        <span className="rounded bg-trust-100 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-widest text-trust-700">
          {badge}
        </span>
      )}
      {role && <span className="text-trust-500">{role}</span>}
      {verified && (
        <span className="ml-auto rounded bg-emerald-50 px-1.5 py-0.5 text-[0.58rem] font-semibold text-emerald-700">
          ID verified
        </span>
      )}
    </div>
  );
}

function Icon({ kind }) {
  const base = 'grid h-5 w-5 place-items-center rounded-md text-[0.6rem] font-bold';
  if (kind === 'trust') return <span className={`${base} bg-trust-100 text-trust-700`}>★</span>;
  if (kind === 'person') return <span className={`${base} bg-trust-50 text-trust-700 ring-1 ring-trust-100`}>P</span>;
  if (kind === 'company') return <span className={`${base} bg-warm-50 text-amber-700 ring-1 ring-warm-100`}>C</span>;
  return <span className={`${base} bg-trust-50 text-trust-700`}>·</span>;
}
