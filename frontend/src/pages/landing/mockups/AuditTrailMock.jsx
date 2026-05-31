import { BrowserFrame } from './BrowserFrame.jsx';

const ENTRIES = [
  { time: '14:08:22', actor: 'manager@firm.nz',   action: 'DEAL_APPROVED',     tone: 'success',
    summary: 'Approved DEAL-2026-0142 — "All checks passed."' },
  { time: '13:55:01', actor: 'compliance@firm.nz', action: 'VERIFICATION_TRIGGERED', tone: 'info',
    summary: 'LINZ title check started — title NA12B/345' },
  { time: '13:48:17', actor: 'compliance@firm.nz', action: 'DEAL_ASSIGNED',     tone: 'primary',
    summary: 'Claimed for review' },
  { time: '13:11:42', actor: 'broker1@firm.nz',    action: 'DEAL_SUBMITTED',    tone: 'primary',
    summary: 'Submitted for review' },
  { time: '13:09:58', actor: 'broker1@firm.nz',    action: 'DOCUMENT_UPLOADED', tone: 'info',
    summary: 'Trust deed.pdf (1.2 MB)' },
];

const TONE = {
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  info:    'bg-trust-100 text-trust-700 ring-trust-200',
  primary: 'bg-trust-700 text-white ring-trust-700',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  error:   'bg-rose-100 text-rose-800 ring-rose-200',
};

export function AuditTrailMock() {
  return (
    <BrowserFrame label="amldock.app · audit / deal 142">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-trust-500">
              Audit trail
            </div>
            <div className="text-base font-bold text-trust-900">DEAL-2026-0142</div>
          </div>
          <span className="rounded-full bg-trust-50 px-3 py-1 text-[0.7rem] font-semibold text-trust-700 ring-1 ring-trust-100">
            Immutable · 12 events
          </span>
        </div>

        <ol className="mt-4 space-y-2.5 border-l-2 border-trust-100 pl-4">
          {ENTRIES.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.13rem] top-2 h-2 w-2 rounded-full bg-trust-400 ring-4 ring-white" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.74rem]">
                <span className="font-mono text-trust-500">{e.time}</span>
                <span className={['rounded px-1.5 py-0.5 text-[0.62rem] font-semibold ring-1', TONE[e.tone]].join(' ')}>
                  {e.action}
                </span>
                <span className="text-trust-700">{e.summary}</span>
              </div>
              <div className="mt-0.5 text-[0.68rem] text-trust-500">{e.actor}</div>
            </li>
          ))}
        </ol>
      </div>
    </BrowserFrame>
  );
}
