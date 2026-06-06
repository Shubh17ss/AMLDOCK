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

  return (
    <div
      className="relative min-h-screen font-body text-neu-fg"
      style={{ backgroundColor: '#E0E5EC' }}
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
