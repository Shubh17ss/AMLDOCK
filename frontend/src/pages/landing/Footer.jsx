import { Link as RouterLink } from 'react-router-dom';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Ownership tree', href: '#product' },
      { label: 'Evidence room', href: '#product' },
      { label: 'Audit log', href: '#product' },
      { label: 'Lifecycle', href: '#how' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Customers', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: 'mailto:hello@amldock.app' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'NZ AML/CFT guide', href: '#' },
      { label: 'Onboarding checklist', href: '#' },
      { label: 'Status', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Sub-processors', href: '#' },
      { label: 'Security', href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-trust-100 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <RouterLink to="/" className="inline-flex items-center gap-2 text-trust-800">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-trust-500 to-trust-700 text-[0.7rem] font-bold text-white shadow-md shadow-trust-500/30">
                A
              </span>
              <span className="text-base font-bold tracking-[0.18em]">AMLDOCK</span>
            </RouterLink>
            <p className="mt-4 max-w-sm font-baskerville italic text-trust-700">
              Compliance, at human pace. Built in Aotearoa New Zealand for real-estate
              firms tired of spreadsheet sprawl.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-trust-500">
                  {col.title}
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-trust-700" style={{ listStyleType: 'none', paddingLeft: 0 }}>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="hover:text-trust-900">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-trust-100 pt-6 text-xs text-trust-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} AMLDOCK Ltd. All rights reserved.</p>
          <p>Built for the NZ AML/CFT Act 2009.</p>
        </div>
      </div>
    </footer>
  );
}
