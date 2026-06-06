import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import logoSrc from '../../../assets/logos/image.png';
import './Navbar.css';

export function Navbar({ isAuthed, dashboardHref }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: '#E0E5EC', boxShadow: '0 6px 16px rgb(163,177,198,0.45), 0 -1px 0 rgba(255,255,255,0.9)' }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-[5.5rem] items-center justify-between">

          {/* Brand */}
          <RouterLink to="/" className="flex items-center neu-focus rounded-2xl">
            <img src={logoSrc} alt="AMLDOCK" className="h-24 w-auto object-contain" />
          </RouterLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="#product">Product</NavLink>
            <NavLink href="#how">How it works</NavLink>
            <NavLink href="#security">Security</NavLink>
            <NavLink href="#contact">Contact</NavLink>
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
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition duration-300 ease-out md:hidden neu-focus"
            style={{ backgroundColor: '#E0E5EC', boxShadow: open ? 'inset 4px 4px 8px rgb(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5)' : '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)' }}
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="neu-menu-slide pb-5 md:hidden">
            <div
              className="rounded-[20px] p-4"
              style={{ backgroundColor: '#E0E5EC', boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)' }}
            >
              <div className="flex flex-col gap-1">
                {['#product', '#how', '#security', '#contact'].map((href, i) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-neu-muted transition duration-300 hover:text-neu-fg"
                    style={{ ':hover': { boxShadow: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)' } }}
                  >
                    {['Product', 'How it works', 'Security', 'Contact'][i]}
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-white/40 pt-3">
                {isAuthed ? (
                  <PrimaryBtn as={RouterLink} to={dashboardHref} fullWidth>Open dashboard</PrimaryBtn>
                ) : (
                  <>
                    <SecondaryBtn as={RouterLink} to="/login" fullWidth>Sign in</SecondaryBtn>
                    <PrimaryBtn as={RouterLink} to="/login" fullWidth>Get started</PrimaryBtn>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="rounded-xl px-4 py-2 text-sm font-medium text-neu-muted transition duration-300 ease-out hover:text-neu-fg neu-focus"
      style={{ backgroundColor: '#E0E5EC' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {children}
    </a>
  );
}

function PrimaryBtn({ as: Tag = 'button', to, href, children, fullWidth }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
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

function SecondaryBtn({ as: Tag = 'button', to, href, children, fullWidth }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
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
