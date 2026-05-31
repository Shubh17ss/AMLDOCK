import { Link as RouterLink } from 'react-router-dom';
import { DealReviewMock } from './mockups/DealReviewMock.jsx';

export function Hero({ isAuthed, dashboardHref }) {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-20 md:grid-cols-12 md:pb-24 md:pt-28">
        {/* Copy column */}
        <div className="md:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-trust-200 bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-trust-700 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            NZ AML/CFT · purpose-built for real estate
          </div>

          <h1
            className="mt-6 font-baskerville font-bold text-trust-900"
            style={{ fontSize: 'clamp(2.5rem, 5.6vw, 4.5rem)', lineHeight: 1.04, letterSpacing: '-0.005em' }}
          >
            Compliance, calmer.
            <br />
            <span className="text-trust-500">For every deal you close.</span>
          </h1>

          <p className="mt-6 max-w-xl font-baskerville text-lg leading-relaxed text-trust-700">
            AMLDOCK guides brokers, compliance officers and managers through the same
            source of truth — from first draft to final decision — without the spreadsheet
            sprawl.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthed ? (
              <RouterLink
                to={dashboardHref}
                className="rounded-[0.7rem] bg-trust-700 px-6 py-3 text-white shadow-lg shadow-trust-900/10 transition-colors hover:bg-trust-800"
              >
                Open dashboard
              </RouterLink>
            ) : (
              <>
                <RouterLink
                  to="/login"
                  className="rounded-[0.7rem] bg-trust-700 px-6 py-3 text-white shadow-lg shadow-trust-900/10 transition-colors hover:bg-trust-800"
                >
                  Get started
                </RouterLink>
                <a
                  href="#product"
                  className="rounded-[0.7rem] bg-white/70 px-6 py-3 text-trust-700 ring-1 ring-trust-200 backdrop-blur transition-colors hover:bg-white"
                >
                  See the product
                </a>
              </>
            )}
          </div>
        </div>

        {/* Mockup column */}
        <div className="relative md:col-span-6">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-trust-100/60 via-white/0 to-warm-100/50 blur-2xl" />
          <DealReviewMock />
        </div>
      </div>

      {/* Trust strip */}
      <TrustStrip />
    </section>
  );
}

function TrustStrip() {
  return (
    <div id="trust" className="border-y border-trust-100 bg-white/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-8 md:flex-row md:justify-between">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-trust-500">
          Built around the NZ AML/CFT Act
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-trust-700">
          <TrustChip>LINZ title look-up</TrustChip>
          <TrustChip>NZ Companies Office</TrustChip>
          <TrustChip>NZBN matching</TrustChip>
          <TrustChip>DIA-aligned IDV</TrustChip>
          <TrustChip>Immutable audit trail</TrustChip>
        </ul>
      </div>
    </div>
  );
}

function TrustChip({ children }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-trust-400" />
      {children}
    </li>
  );
}
