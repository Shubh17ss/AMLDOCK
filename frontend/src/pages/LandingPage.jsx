import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../landing.css';
import { Navbar } from './landing/Navbar.jsx';
import { Hero } from './landing/Hero.jsx';
import { Features } from './landing/Features.jsx';
import { HowItWorks } from './landing/HowItWorks.jsx';
import { CTABanner } from './landing/CTABanner.jsx';
import { Footer } from './landing/Footer.jsx';

export function LandingPage() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authed' && user;
  const dashboardHref = '/app';
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const id = hash.replace('#', '');
    // Small delay lets the page finish painting before scrolling
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const navbarHeight = 88; // matches h-[5.5rem]
      const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div
      className="relative min-h-screen font-body"
      style={{ backgroundColor: '#FFFFFF', color: '#111111' }}
    >
      <Navbar isAuthed={isAuthed} dashboardHref={dashboardHref} />
      <main>
        <Hero isAuthed={isAuthed} dashboardHref={dashboardHref} />
        <Features />
        <HowItWorks />
        <CTABanner isAuthed={isAuthed} dashboardHref={dashboardHref} />
      </main>
      <Footer />
    </div>
  );
}
