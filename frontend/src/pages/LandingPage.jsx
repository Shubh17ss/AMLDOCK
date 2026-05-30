import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import '../landing.css';

/**
 * Public landing page. Tailwind-only — no MUI components so the page can keep its own
 * baseline reset and font system separate from the in-app MUI surfaces.
 */
export function LandingPage() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authed' && user;
  const dashboardHref = '/app';

  return (
    <div className="font-baskerville bg-white text-trust-900 min-h-screen">
      <Navbar isAuthed={isAuthed} dashboardHref={dashboardHref} />
      <Hero isAuthed={isAuthed} dashboardHref={dashboardHref} />
      <ValueProps />
      <Footer />
    </div>
  );
}

function Navbar({ isAuthed, dashboardHref }) {
  return (
    <nav
      className={[
        'fixed inset-x-0 top-0 z-50',
        'backdrop-blur-md bg-white/55 supports-[backdrop-filter]:bg-white/40',
        'border-b border-white/40',
      ].join(' ')}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <RouterLink to="/" className="flex items-center gap-2 text-trust-700 hover:text-trust-900 transition-colors">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-trust-500" aria-hidden="true" />
          <span className="text-xl tracking-[0.18em] font-bold">AMLDOCK</span>
        </RouterLink>
        <div className="flex items-center gap-2 text-sm">
          <a href="#why" className="hidden sm:inline px-3 py-1.5 text-trust-700 hover:text-trust-900 transition-colors">
            Why AMLDOCK
          </a>
          {isAuthed ? (
            <RouterLink
              to={dashboardHref}
              className="px-4 py-2 rounded-full bg-trust-700 text-white hover:bg-trust-800 transition-colors"
            >
              Open dashboard
            </RouterLink>
          ) : (
            <>
              <RouterLink
                to="/login"
                className="px-4 py-2 rounded-full text-trust-700 ring-1 ring-trust-300 hover:bg-trust-50 transition-colors"
              >
                Sign in
              </RouterLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function Hero({ isAuthed, dashboardHref }) {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Background image — held still, blurred behind the translucent overlay */}
      <div
        className="absolute inset-0 bg-hero-cityscape bg-cover bg-center"
        aria-hidden="true"
      />
      {/* Blur + tonal wash. backdrop-blur is what gives the soft, in-focus feel to the
          centered text — the image stays sharp on disk but is blurred behind this layer. */}
      <div
        className="absolute inset-0 backdrop-blur-md bg-white/45 supports-[backdrop-filter]:bg-white/30"
        aria-hidden="true"
      />
      {/* A subtle radial darkening toward the corners pulls the eye to the centre. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,255,255,0) 35%, rgba(15,42,79,0.18) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
        <p className="uppercase tracking-[0.4em] text-xs text-trust-600 mb-6">
          NZ real-estate · AML compliance
        </p>
        <h1
          className="text-trust-900 font-baskerville font-bold leading-none"
          style={{ fontSize: 'clamp(3.5rem, 10vw, 8rem)', letterSpacing: '0.06em' }}
        >
          AMLDOCK
        </h1>
        <p className="mt-6 max-w-2xl text-lg sm:text-xl text-trust-800 italic font-normal">
          Calmer compliance for every real-estate deal — onboard owners, model nested
          ownership, verify identities, and decide with confidence.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {isAuthed ? (
            <RouterLink
              to={dashboardHref}
              className="px-6 py-3 rounded-full bg-trust-700 text-white text-base hover:bg-trust-800 transition-colors shadow-lg shadow-trust-900/10"
            >
              Open dashboard
            </RouterLink>
          ) : (
            <>
              <RouterLink
                to="/login"
                className="px-6 py-3 rounded-full bg-trust-700 text-white text-base hover:bg-trust-800 transition-colors shadow-lg shadow-trust-900/10"
              >
                Sign in
              </RouterLink>
              <a
                href="#why"
                className="px-6 py-3 rounded-full text-trust-700 text-base ring-1 ring-trust-300 hover:bg-white/60 transition-colors backdrop-blur-sm bg-white/40"
              >
                Learn more
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ValueProps() {
  return (
    <section id="why" className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl text-trust-900 font-baskerville font-bold mb-4">
          A calmer way to clear every deal
        </h2>
        <p className="text-trust-700 max-w-2xl mb-12 leading-relaxed">
          AMLDOCK guides brokers, compliance officers, and managers through the
          same source of truth — from first draft to final decision — without the
          spreadsheet sprawl.
        </p>

        <div className="grid gap-8 sm:grid-cols-3">
          <Pillar
            title="Map the ownership"
            body="Build nested structures for trusts, companies, partnerships, and people — with percentages and roles on every edge."
          />
          <Pillar
            title="Centralise the evidence"
            body="DLs, passports, sale agreements, trust deeds — uploaded once, attached to the right node, reviewable side-by-side."
          />
          <Pillar
            title="Decide with a full audit trail"
            body="Every claim, approval, rejection, and override leaves an immutable record. Manager override is one click, always justified."
          />
        </div>
      </div>
    </section>
  );
}

function Pillar({ title, body }) {
  return (
    <div className="border-t-2 border-trust-500/40 pt-5">
      <h3 className="text-xl text-trust-900 font-baskerville font-bold mb-2">{title}</h3>
      <p className="text-trust-700 leading-relaxed text-[0.95rem]">{body}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-trust-50 border-t border-trust-100 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-trust-700">
        <p className="font-baskerville">
          <span className="tracking-[0.18em] font-bold text-trust-800">AMLDOCK</span>
          {' '}·{' '}
          <span className="italic">Compliance, at human pace.</span>
        </p>
        <p className="text-trust-500">© {new Date().getFullYear()} AMLDOCK</p>
      </div>
    </footer>
  );
}
