import { Link as RouterLink } from 'react-router-dom';
import './Navbar.css'; // Import the CSS file for styling

export function Navbar({ isAuthed, dashboardHref }) {
  return (
    <header className="sticky top-0 z-50 border-b border-trust-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <RouterLink
          to="/"
          className="flex items-center gap-2 text-trust-800 transition-colors hover:text-trust-900"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-trust-500 to-trust-700 text-[0.7rem] font-bold text-white shadow-md shadow-trust-500/30">
            A
          </span>
          <span className="text-base font-bold tracking-[0.18em]">AMLDOCK</span>
        </RouterLink>

        <nav className="hidden items-center gap-7 text-sm text-trust-900 md:flex">
          <a href="#product" >Product</a>
          <a href="#how" >How it works</a>
          <a href="#trust" >Trust &amp; controls</a>
          <a href="#contact">Contact</a>
          {isAuthed ? (
            <RouterLink to={dashboardHref} >Open dashboard</RouterLink>
          ) : (
            <RouterLink to="/login" >Sign in</RouterLink>
          )}
        </nav>

        {/* Compact (mobile) variant: still text-only, matches desktop nav links */}
        <div className="text-sm text-trust-900 md:hidden">
          {isAuthed ? (
            <RouterLink to={dashboardHref} >Open dashboard</RouterLink>
          ) : (
            <RouterLink to="/login" >Sign in</RouterLink>
          )}
        </div>
      </div>
    </header>
  );
}
