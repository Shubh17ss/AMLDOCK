import { MotionConfig, motion } from 'motion/react';
import './site.css';
import { Logo } from './Navbar.jsx';
import { EASE } from './tokens.js';

const POINTS = [
  { head: 'One-time codes', body: 'A code is sent to your email each time you sign in.' },
  { head: 'Your listings only', body: 'You see the files your role and branch are responsible for.' },
  { head: 'On the record', body: 'Changes are logged with who made them.' },
];

/**
 * Frame for the two sign-in pages: a dark panel beside the form on wide screens, the form alone
 * on narrow ones. Purely presentational — the forms and their handlers live in the pages.
 */
export function AuthShell({ children, footer }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="site site-auth">
        <aside className="site-auth__aside">
          <div className="site-dark__plan" aria-hidden="true" />
          <p className="site-h3">AMLDOCK</p>
          <div style={{ display: 'grid', gap: 32 }}>
            <p className="site-h1" style={{ maxWidth: '9em' }}>Know who you’re selling for.</p>
            <ul>
              {POINTS.map((p) => <li key={p.head}><b>{p.head}</b>{p.body}</li>)}
            </ul>
          </div>
        </aside>

        <div className="site-auth__main">
          <div className="site-auth__top">
            <Logo />
          </div>
          <div className="site-auth__center">
            <motion.div
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {children}
            </motion.div>
          </div>
          {footer && <div className="site-auth__foot">{footer}</div>}
        </div>
      </div>
    </MotionConfig>
  );
}
