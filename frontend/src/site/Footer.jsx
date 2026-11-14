import { Link as RouterLink } from 'react-router-dom';
import { Logo } from './Navbar.jsx';
import { CONTACT_EMAIL } from './content/company.js';

// Only links that resolve. Add a column when the page behind it exists. The administrator's
// sign-in is reached by its address and is not linked from anywhere.
const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', to: '/platform' },
      { label: 'Security', to: '/security' },
      { label: 'Pricing',  to: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About',   to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Sign in', to: '/login' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy',       to: '/privacy' },
      { label: 'Terms and conditions', to: '/terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-wrap">
        <div className="site-footer__grid">
          <div>
            <Logo />
            <p className="site-body" style={{ marginTop: 16, maxWidth: '24em' }}>
              AML/CFT record-keeping for New Zealand real-estate agencies.
            </p>
            <p style={{ marginTop: 12 }}>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>

          <div className="site-footer__cols">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4>{col.title}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.to}><RouterLink to={l.to}>{l.label}</RouterLink></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="site-footer__base">
          <span>© {new Date().getFullYear()} AMLDOCK Ltd</span>
          <span>Built for the Anti-Money Laundering and Countering Financing of Terrorism Act 2009</span>
        </div>
      </div>
    </footer>
  );
}
