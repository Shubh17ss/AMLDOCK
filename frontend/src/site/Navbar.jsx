import { useEffect, useState } from 'react';
import { Link as RouterLink, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import logoSrc from '../../assets/logos/image.png';
import { Button } from './ui/Button.jsx';
import { EASE } from './tokens.js';

const LINKS = [
  { to: '/platform', label: 'Platform' },
  { to: '/security', label: 'Security' },
  { to: '/pricing',  label: 'Pricing' },
  { to: '/about',    label: 'About' },
  { to: '/contact',  label: 'Contact' },
];

export function Logo() {
  return (
    <RouterLink to="/" className="site-logo" aria-label="AMLDOCK home">
      <img src={logoSrc} alt="" />
    </RouterLink>
  );
}

export function Navbar({ isAuthed }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The sheet covers the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <header className="site-nav" data-scrolled={scrolled} data-open={open}>
        <div className="site-wrap site-nav__row">
          <Logo />

          <nav className="site-nav__links" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="site-nav__link">{l.label}</NavLink>
            ))}
          </nav>

          <div className="site-nav__cta">
            {isAuthed ? (
              <Button to="/app" size="sm">Open dashboard</Button>
            ) : (
              <>
                <Button to="/login" variant="ghost" size="sm">Sign in</Button>
                <Button to="/contact" size="sm">Book a demo</Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="site-nav__toggle"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <motion.path
                d="M3 7h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                animate={open ? { rotate: 45, y: 3 } : { rotate: 0, y: 0 }}
                style={{ transformOrigin: '10px 7px' }}
              />
              <motion.path
                d="M3 13h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                animate={open ? { rotate: -45, y: -3 } : { rotate: 0, y: 0 }}
                style={{ transformOrigin: '10px 13px' }}
              />
            </svg>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="site-nav__sheet"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav aria-label="Main">
              {LINKS.map((l, i) => (
                <motion.div
                  key={l.to}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay: 0.04 * i }}
                >
                  <RouterLink to={l.to} className="site-nav__sheetLink" onClick={() => setOpen(false)}>
                    {l.label}
                  </RouterLink>
                </motion.div>
              ))}
            </nav>
            <div className="site-nav__sheetCta">
              {isAuthed ? (
                <Button to="/app" block>Open dashboard</Button>
              ) : (
                <>
                  <Button to="/contact" block>Book a demo</Button>
                  <Button to="/login" variant="ghost" block>Sign in</Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
