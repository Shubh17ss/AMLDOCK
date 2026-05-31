import { useAuth } from '../auth/AuthContext.jsx';
import '../landing.css';
import { Navbar } from './landing/Navbar.jsx';
import { Hero } from './landing/Hero.jsx';
import { Features } from './landing/Features.jsx';
import { HowItWorks } from './landing/HowItWorks.jsx';
import { CTABanner } from './landing/CTABanner.jsx';
import { Footer } from './landing/Footer.jsx';
import { GradientBackground } from './landing/GradientBackground.jsx';

/**
 * Public landing page — Persona-inspired flow.
 * Tailwind-only so it stays out of MUI's way; preflight is disabled in tailwind.config
 * so the rest of the (MUI) app keeps its baseline reset.
 */
export function LandingPage() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authed' && user;
  const dashboardHref = '/app';

  return (
    <div className="relative min-h-screen bg-white font-baskerville text-trust-900">
      <GradientBackground />
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
