import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import logoSrc from '../../../assets/logos/image.png';
import { CLR, SH } from './clr.js';
import './Navbar.css';

const CLOSE_DURATION = 200; // ms — must match menuRise animation

export function Navbar({ isAuthed, dashboardHref }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  };

  const closeMenu = () => {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_DURATION);
  };

  const handleToggle = () => (open ? closeMenu() : openMenu());
  const handleLinkClick = () => { setOpen(false); setClosing(false); };

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        backgroundColor: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: `1px solid ${CLR.hairline}`,
      }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-[4.5rem] items-center justify-between">

          {/* Brand */}
          <RouterLink to="/" className="flex items-center clr-focus rounded-xl">
            <img src={logoSrc} alt="AMLDOCK" className="h-20 w-auto object-contain" />
          </RouterLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/#product">Product</NavLink>
            <NavLink to="/#how">How it works</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2.5 md:flex">
            {isAuthed ? (
              <PrimaryBtn as={RouterLink} to={dashboardHref}>Open dashboard</PrimaryBtn>
            ) : (
              <>
                <SecondaryBtn as={RouterLink} to="/login">Sign in</SecondaryBtn>
                <PrimaryBtn as={RouterLink} to="/login">Get started</PrimaryBtn>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 md:hidden clr-focus"
            style={{
              backgroundColor: open ? CLR.blueWash : '#fff',
              border: `1px solid ${open ? CLR.blue : CLR.hairline2}`,
            }}
            onClick={handleToggle}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {/* key forces remount → triggers spin-in animation on every swap */}
            <span key={open ? 'x' : 'menu'} className="neu-ham-icon flex items-center justify-center">
              {open ? <XIcon /> : <MenuIcon />}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile menu — absolute so it overlays content without shifting layout */}
      {(open || closing) && (
        <div
          className={`${closing ? 'neu-menu-close' : 'neu-menu-open'} absolute left-0 right-0 top-full md:hidden`}
          style={{ zIndex: 49 }}
        >
          <div className="mx-auto max-w-7xl px-6 pb-4 pt-2">
            <div
              className="clr-card rounded-2xl p-3"
              style={{ boxShadow: SH.lg }}
            >
              <div className="flex flex-col gap-0.5">
                {[
                  { to: '/#product', label: 'Product' },
                  { to: '/#how',     label: 'How it works' },
                  { to: '/pricing',  label: 'Pricing' },
                  { to: '/contact',  label: 'Contact' },
                ].map((item) => (
                  <RouterLink
                    key={item.to}
                    to={item.to}
                    onClick={handleLinkClick}
                    className="neu-menu-item rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150"
                    style={{ color: CLR.muted }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = CLR.blueWash; e.currentTarget.style.color = CLR.ink; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = CLR.muted; }}
                  >
                    {item.label}
                  </RouterLink>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 pt-3" style={{ borderTop: `1px solid ${CLR.hairline}` }}>
                {isAuthed ? (
                  <PrimaryBtn as={RouterLink} to={dashboardHref} fullWidth onClick={handleLinkClick}>Open dashboard</PrimaryBtn>
                ) : (
                  <>
                    <SecondaryBtn as={RouterLink} to="/login" fullWidth onClick={handleLinkClick}>Sign in</SecondaryBtn>
                    <PrimaryBtn as={RouterLink} to="/login" fullWidth onClick={handleLinkClick}>Get started</PrimaryBtn>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ to, children }) {
  return (
    <RouterLink
      to={to}
      className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 clr-focus"
      style={{ color: CLR.muted }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = CLR.blueWash; e.currentTarget.style.color = CLR.ink; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = CLR.muted; }}
    >
      {children}
    </RouterLink>
  );
}

function PrimaryBtn({ as: Tag = 'button', to, href, children, fullWidth, onClick }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 clr-focus ${fullWidth ? 'w-full' : ''}`}
      style={{ backgroundColor: CLR.blue, boxShadow: SH.sm }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = CLR.blueDark; e.currentTarget.style.boxShadow = SH.md; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = CLR.blue; e.currentTarget.style.boxShadow = SH.sm; }}
    >
      {children}
    </Tag>
  );
}

function SecondaryBtn({ as: Tag = 'button', to, href, children, fullWidth, onClick }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 clr-focus ${fullWidth ? 'w-full' : ''}`}
      style={{ backgroundColor: '#fff', color: CLR.ink, border: `1px solid ${CLR.hairline2}` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = CLR.blue; e.currentTarget.style.backgroundColor = CLR.blueWash; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = CLR.hairline2; e.currentTarget.style.backgroundColor = '#fff'; }}
    >
      {children}
    </Tag>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="#111111" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5L5 15" stroke="#1B5FE3" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
