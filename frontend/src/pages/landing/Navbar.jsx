import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import logoSrc from '../../../assets/logos/image.png';
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
      style={{ backgroundColor: '#E0E5EC', boxShadow: '0 6px 16px rgb(163,177,198,0.45), 0 -1px 0 rgba(255,255,255,0.9)', position: 'sticky' }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-[5.5rem] items-center justify-between">

          {/* Brand */}
          <RouterLink to="/" className="flex items-center neu-focus rounded-2xl">
            <img src={logoSrc} alt="AMLDOCK" className="h-24 w-auto object-contain" />
          </RouterLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/#product">Product</NavLink>
            <NavLink to="/#how">How it works</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 md:flex">
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
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-shadow duration-300 ease-out md:hidden neu-focus"
            style={{
              backgroundColor: '#E0E5EC',
              boxShadow: open
                ? 'inset 4px 4px 8px rgb(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5)'
                : '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
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
              className="rounded-[20px] p-4"
              style={{ backgroundColor: '#E0E5EC', boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)' }}
            >
              <div className="flex flex-col gap-1">
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
                    className="neu-menu-item rounded-xl px-4 py-3 text-sm font-medium text-neu-muted transition duration-200 hover:text-neu-fg"
                  >
                    {item.label}
                  </RouterLink>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-white/40 pt-3">
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
      className="rounded-xl px-4 py-2 text-sm font-medium text-neu-muted transition duration-300 ease-out hover:text-neu-fg neu-focus"
      style={{ backgroundColor: '#E0E5EC' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
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
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition duration-300 ease-out hover:-translate-y-px active:translate-y-px neu-focus ${fullWidth ? 'w-full' : ''}`}
      style={{
        backgroundColor: '#6C63FF',
        boxShadow: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)'; }}
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
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-medium text-neu-fg transition duration-300 ease-out hover:-translate-y-px active:translate-y-px neu-focus ${fullWidth ? 'w-full' : ''}`}
      style={{
        backgroundColor: '#E0E5EC',
        boxShadow: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)'; }}
    >
      {children}
    </Tag>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="#3D4852" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5L5 15" stroke="#3D4852" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
