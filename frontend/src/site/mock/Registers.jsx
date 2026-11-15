import { NodeGlyph, Check } from '../ui/icons.jsx';

/** Still mock-ups for the Platform and Security pages. Sample data throughout. */

const LISTINGS = [
  { ref: '0142', addr: '12 Cuba Street, Te Aro',     client: 'Smith Family Trust', chip: 'review',   label: 'In review' },
  { ref: '0141', addr: '8 Oriental Parade',          client: 'Hana Walker',        chip: 'verified', label: 'Verified' },
  { ref: '0139', addr: '3/41 Ghuznee Street',        client: 'Tasman Holdings Ltd', chip: 'new',     label: 'New' },
  { ref: '0136', addr: '27 Aro Street, Aro Valley',  client: 'R. and P. Kumar',    chip: 'closed',   label: 'Closed' },
];

export function ListingRegisterMock() {
  return (
    <div className="mock" role="img" aria-label="Sample listing register">
      <div className="mock__head">
        <div>
          <div className="mock__title">Listing register</div>
          <div className="mock__sub">Wellington Central branch</div>
        </div>
        <span className="chip chip--plain chip--new">4 of 38</span>
      </div>
      <div className="mock__pane">
        {LISTINGS.map((l) => (
          <div key={l.ref} className="doc" style={{ padding: '9px 0', borderBottom: '1px solid var(--s-line)' }}>
            <span className="site-mono" style={{ color: 'var(--s-muted)', width: 40 }}>{l.ref}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="doc__name" style={{ display: 'block', fontWeight: 600 }}>{l.addr}</span>
              <span className="doc__name" style={{ display: 'block', color: 'var(--s-muted)', fontSize: '0.75rem' }}>{l.client}</span>
            </span>
            <span className={`chip chip--${l.chip}`}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const OWNERS = [
  { name: 'John Smith',   via: 'Trustee, Smith Family Trust',        ok: true },
  { name: 'Jane Smith',   via: 'Trustee, Smith Family Trust',        ok: true },
  { name: 'Olivia Smith', via: 'Director, Smith Holdings Ltd',       ok: true },
  { name: 'Wei Zhang',    via: 'Shareholder, Tasman Holdings Ltd',   ok: false },
];

export function BeneficialOwnersMock() {
  return (
    <div className="mock" role="img" aria-label="Sample beneficial owners register">
      <div className="mock__head">
        <div>
          <div className="mock__title">Beneficial owners</div>
          <div className="mock__sub">Every individual behind a listing, in one register</div>
        </div>
      </div>
      <div className="mock__pane">
        {OWNERS.map((o) => (
          <div key={o.name} className="tree__row" style={{ padding: '8px 0' }}>
            <span className="tree__icon"><NodeGlyph kind="person" /></span>
            <span style={{ minWidth: 0 }}>
              <span className="tree__name" style={{ display: 'block' }}>{o.name}</span>
              <span className="tree__role" style={{ display: 'block' }}>{o.via}</span>
            </span>
            {o.ok ? <span className="tree__tick"><Check size={10} /></span> : <span className="tree__pending" />}
          </div>
        ))}
      </div>
    </div>
  );
}

const EVENTS = [
  { time: '14:05:22', what: 'Deal verified',        who: 'S. Patel, Compliance officer' },
  { time: '13:48:17', what: 'Risk rating set',      who: 'S. Patel, Compliance officer' },
  { time: '13:31:09', what: 'Document reviewed',    who: 'S. Patel, Compliance officer' },
  { time: '11:40:51', what: 'Submitted for review', who: 'M. Chen, Agent' },
  { time: '11:38:02', what: 'Document uploaded',    who: 'M. Chen, Agent' },
  { time: '09:12:40', what: 'Deal created',         who: 'M. Chen, Agent' },
];

export function AuditLogMock() {
  return (
    <div className="mock" role="img" aria-label="Sample audit log">
      <div className="mock__head">
        <div>
          <div className="mock__title">Audit log</div>
          <div className="mock__sub">Listing <span className="site-mono">0142</span></div>
        </div>
        <span className="chip chip--plain chip--new">Read only</span>
      </div>
      <div className="mock__pane">
        <div className="trail" style={{ gap: 12 }}>
          {EVENTS.map((e) => (
            <div key={e.time} className="trail__row">
              <span className="trail__time">{e.time}</span>
              <span className="trail__what"><b>{e.what}</b> <span>{e.who}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
