import { Link as RouterLink } from 'react-router-dom';

export function CTABanner({ isAuthed, dashboardHref }) {
  return (
    <section id="contact" className="px-6 py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-trust-700 via-trust-700 to-trust-900 px-8 py-14 text-center shadow-2xl shadow-trust-900/30 sm:px-16 sm:py-20">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-warm-100/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-trust-500/30 blur-3xl" aria-hidden="true" />

        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-trust-200">
          Ready when you are
        </p>
        <h2 className="mt-3 font-baskerville text-3xl font-bold text-white sm:text-5xl">
          Bring calm to your next deal.
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-baskerville text-base text-trust-100/90 sm:text-lg">
          Spin up your firm in minutes. Invite your brokers and compliance officers. Run a
          deal end-to-end with the whole audit trail to show for it.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isAuthed ? (
            <RouterLink
              to={dashboardHref}
              className="rounded-[0.7rem] bg-white px-6 py-3 text-trust-800 shadow-lg shadow-black/10 transition-colors hover:bg-trust-50"
            >
              Open dashboard
            </RouterLink>
          ) : (
            <>
              <RouterLink
                to="/login"
                className="rounded-[0.7rem] bg-white px-6 py-3 text-trust-800 shadow-lg shadow-black/10 transition-colors hover:bg-trust-50"
              >
                Get started
              </RouterLink>
              <a
                href="mailto:hello@amldock.app"
                className="rounded-[0.7rem] px-6 py-3 text-white ring-1 ring-white/40 transition-colors hover:bg-white/10"
              >
                Talk to us
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
