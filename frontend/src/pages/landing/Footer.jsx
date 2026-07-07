import { Link as RouterLink } from 'react-router-dom';
import { CLR } from './clr.js';
import { Reveal } from './reveal.jsx';

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
    <footer style={{ backgroundColor: '#fff', borderTop: `1px solid ${CLR.hairline}` }}>
      <Reveal className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">

          {/* Brand block */}
          <div className="md:col-span-4">
            <RouterLink to="/" className="inline-flex items-center gap-3 clr-focus rounded-xl">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: CLR.blueWash }}
              >
                <ShieldCheckIcon />
              </div>
              <span className="font-grotesk text-[0.95rem] font-bold tracking-tight" style={{ color: CLR.ink }}>
                AMLDOCK
              </span>
            </RouterLink>

            <p className="mt-4 max-w-xs text-[0.9rem] leading-relaxed" style={{ color: CLR.muted }}>
              Compliance, at human pace. Built in Aotearoa New Zealand for real-estate
              firms tired of spreadsheet sprawl.
            </p>

            <FooterLink href="mailto:hello@amldock.app" className="mt-5 inline-flex px-1">
              hello@amldock.app
            </FooterLink>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
            {COLUMNS.map(col => (
              <div key={col.title}>
                <h4 className="clr-eyebrow mb-3.5" style={{ fontSize: '0.64rem' }}>{col.title}</h4>
                <ul className="list-none p-0 space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.label}>
                      <FooterLink href={l.href}>{l.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright bar */}
        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center"
          style={{ backgroundColor: '#FBFCFE', border: `1px solid ${CLR.hairline}` }}
        >
          <p className="text-[0.73rem]" style={{ color: CLR.muted }}>
            © {new Date().getFullYear()} AMLDOCK Ltd. All rights reserved.
          </p>
          <p className="text-[0.73rem]" style={{ color: CLR.muted, fontFamily: '"FK Grotesk Mono Trial", monospace', letterSpacing: '0.04em' }}>
            Built for the NZ AML/CFT Act 2009.
          </p>
        </div>
      </Reveal>
    </footer>
  );
}

function FooterLink({ href, children, className = '' }) {
  return (
    <a
      href={href}
      className={`text-[0.88rem] transition-colors duration-150 clr-focus rounded ${className}`}
      style={{ color: CLR.muted }}
      onMouseEnter={e => { e.currentTarget.style.color = CLR.blue; }}
      onMouseLeave={e => { e.currentTarget.style.color = CLR.muted; }}
    >
      {children}
    </a>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L3 5.5V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V5.5L10 2Z"
        fill="rgba(27,95,227,0.14)" stroke="#1B5FE3" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 10L8.5 12L13.5 7.5"
        stroke="#1B5FE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
