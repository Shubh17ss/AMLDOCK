import { BrowserFrame } from './BrowserFrame.jsx';

export function EvidenceMock() {
  return (
    <BrowserFrame label="amldock.app · evidence">
      <div className="grid grid-cols-12 gap-0">
        {/* PDF preview side */}
        <div className="col-span-7 border-r border-trust-100 bg-trust-50/40 p-4">
          <div className="rounded-lg border border-trust-100 bg-white shadow-sm">
            <div className="border-b border-trust-100 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-widest text-trust-500">
              Trust deed — Smith Family Trust.pdf · Page 3 / 18
            </div>
            <div className="space-y-1.5 p-4 text-[0.62rem] leading-relaxed text-trust-700">
              <Line w="100%" />
              <Line w="92%" />
              <Line w="74%" />
              <div className="my-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-800">
                Highlight · trustees
              </div>
              <Line w="88%" />
              <Line w="95%" />
              <Line w="60%" />
              <Line w="100%" />
              <Line w="80%" />
              <Line w="70%" />
            </div>
          </div>
        </div>

        {/* Document list */}
        <div className="col-span-5 p-4">
          <div className="text-[0.68rem] font-semibold uppercase tracking-widest text-trust-500">
            Documents on this deal
          </div>
          <ul className="mt-2 space-y-1.5 text-[0.74rem]">
            <Doc name="Trust deed.pdf" kind="TRUST_DEED" tone="trust" active />
            <Doc name="John Smith — DL.jpg" kind="DRIVER_LICENCE" tone="warm" />
            <Doc name="Jane Smith — Passport.jpg" kind="PASSPORT" tone="warm" />
            <Doc name="Sale agreement.pdf" kind="SALE_AGREEMENT" tone="trust" />
            <Doc name="LINZ title — 12 Cuba St.pdf" kind="TITLE_DOC" tone="trust" />
          </ul>
          <div className="mt-3 rounded-lg border border-dashed border-trust-200 bg-trust-50/60 px-3 py-3 text-center text-[0.68rem] text-trust-600">
            Drop files here · max 25 MB
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function Line({ w }) {
  return <div className="h-1.5 rounded bg-trust-200/70" style={{ width: w }} />;
}

function Doc({ name, kind, tone, active }) {
  const toneCls = tone === 'warm' ? 'bg-warm-50 text-amber-700 ring-warm-100' : 'bg-trust-50 text-trust-700 ring-trust-100';
  return (
    <li
      className={[
        'flex items-center justify-between gap-2 rounded-md px-2 py-1.5',
        active ? 'bg-trust-50 ring-1 ring-trust-200' : 'hover:bg-trust-50',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded bg-white text-[0.6rem] font-bold text-trust-700 ring-1 ring-trust-100">
          {kind === 'DRIVER_LICENCE' || kind === 'PASSPORT' ? 'ID' : 'PDF'}
        </span>
        <span className="truncate font-medium text-trust-900">{name}</span>
      </span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-widest ring-1 ${toneCls}`}>
        {kind.replace('_', ' ')}
      </span>
    </li>
  );
}
