import { Link as RouterLink } from 'react-router-dom';

const EXT_SM  = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET   = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';
const INSET_SM= 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Ownership tree', href: '#product' },
      { label: 'Evidence room',  href: '#product' },
      { label: 'Audit log',      href: '#product' },
      { label: 'Lifecycle',      href: '#how' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About',     href: '#' },
      { label: 'Customers', href: '#' },
      { label: 'Careers',   href: '#' },
      { label: 'Contact',   href: 'mailto:hello@amldock.app' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'NZ AML/CFT guide',     href: '#' },
      { label: 'Onboarding checklist', href: '#' },
      { label: 'Status',               href: '#' },
      { label: 'Changelog',            href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy',        href: '#' },
      { label: 'Terms',          href: '#' },
      { label: 'Sub-processors', href: '#' },
      { label: 'Security',       href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ backgroundColor: '#E0E5EC', boxShadow: 'inset 0 2px 8px rgb(163,177,198,0.3)' }}>
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">

          {/* Brand block */}
          <div className="md:col-span-4">
            <RouterLink to="/" className="inline-flex items-center gap-3 neu-focus rounded-2xl">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: '#E0E5EC', boxShadow: EXT_SM }}
              >
                <ShieldCheckIcon />
              </div>
              <span className="font-display text-[0.95rem] font-bold tracking-tight text-neu-fg">
                AMLDOCK
              </span>
            </RouterLink>

            <p className="mt-4 max-w-xs text-[0.9rem] leading-relaxed text-neu-muted">
              Compliance, at human pace. Built in Aotearoa New Zealand for real-estate
              firms tired of spreadsheet sprawl.
            </p>

            <a
              href="mailto:hello@amldock.app"
              className="mt-5 inline-flex items-center gap-1.5 text-[0.85rem] text-neu-muted transition-colors hover:text-neu-fg neu-focus rounded-lg px-1"
            >
              hello@amldock.app
            </a>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
            {COLUMNS.map(col => (
              <div key={col.title}>
                <h4 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neu-muted mb-3">
                  {col.title}
                </h4>
                <ul className="list-none p-0 space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-[0.88rem] text-neu-muted transition-colors hover:text-neu-fg neu-focus rounded px-0.5"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright bar — inset */}
        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center"
          style={{ boxShadow: INSET }}
        >
          <p className="text-[0.73rem] text-neu-muted">
            © {new Date().getFullYear()} AMLDOCK Ltd. All rights reserved.
          </p>
          <p className="text-[0.73rem] text-neu-muted">Built for the NZ AML/CFT Act 2009.</p>
        </div>
      </div>
    </footer>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L3 5.5V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V5.5L10 2Z"
        fill="rgba(108,99,255,0.15)" stroke="#6C63FF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 10L8.5 12L13.5 7.5"
        stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
