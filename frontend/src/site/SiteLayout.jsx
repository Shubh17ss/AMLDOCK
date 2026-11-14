import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { useAuth } from '../auth/AuthContext.jsx';
import './site.css';
import { Navbar } from './Navbar.jsx';
import { Footer } from './Footer.jsx';
import { Rise, Stagger } from './ui/motion.jsx';

/** True when a signed-in user is viewing the public site; swaps the CTAs for "Open dashboard". */
export function useIsAuthed() {
  const { status, user } = useAuth();
  return Boolean(status === 'authed' && user);
}

/**
 * Frame for every public page: nav, footer, and a jump to the top on navigation.
 * `reducedMotion="user"` makes every Motion animation below respect the OS setting.
 */
export function SiteLayout({ children }) {
  const isAuthed = useIsAuthed();
  const { pathname, hash } = useLocation();

  // New page: start at the top, or at the section the link named. The short delay lets the
  // page paint first so the target has its final position.
  useEffect(() => {
    if (!hash) { window.scrollTo({ top: 0, behavior: 'instant' }); return undefined; }
    const t = setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 68, behavior: 'instant' });
    }, 60);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="site">
        <Navbar isAuthed={isAuthed} />
        <main>{children}</main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

/** Opening block of an inner page. */
export function PageHead({ title, lead, children }) {
  return (
    <section className="site-pagehead">
      <div className="site-plan" aria-hidden="true" />
      <Stagger className="site-wrap">
        <Rise as="h1" className="site-h1" style={{ maxWidth: '14em' }}>{title}</Rise>
        {lead && <Rise as="p" className="site-lead">{lead}</Rise>}
        {children && <Rise>{children}</Rise>}
      </Stagger>
    </section>
  );
}
