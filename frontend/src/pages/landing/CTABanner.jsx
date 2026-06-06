import { Link as RouterLink } from 'react-router-dom';

const EXT    = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_SM = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET  = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';
const INSET_SM='inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

export function CTABanner({ isAuthed, dashboardHref }) {
  return (
    <section id="contact" className="py-24 px-6 md:py-32">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[40px] p-14 sm:p-20" style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}>

        {/* Decorative concentric circles — top right corner */}
        <div className="pointer-events-none absolute -top-20 -right-20 opacity-50" aria-hidden="true">
          <div className="flex h-52 w-52 items-center justify-center rounded-full" style={{ boxShadow: INSET }}>
            <div className="flex h-36 w-36 items-center justify-center rounded-full" style={{ boxShadow: EXT }}>
              <div className="h-20 w-20 rounded-full" style={{ boxShadow: INSET }} />
            </div>
          </div>
        </div>

        {/* Decorative circles — bottom left */}
        <div className="pointer-events-none absolute -bottom-16 -left-16 opacity-30 scale-75" aria-hidden="true">
          <div className="flex h-52 w-52 items-center justify-center rounded-full" style={{ boxShadow: EXT }}>
            <div className="flex h-36 w-36 items-center justify-center rounded-full" style={{ boxShadow: INSET }}>
              <div className="h-20 w-20 rounded-full" style={{ boxShadow: EXT }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative text-center">
          {/* Accent badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] mb-6"
            style={{ boxShadow: INSET_SM, color: '#6C63FF' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#38B2AC' }} />
            Ready when you are
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-neu-fg sm:text-5xl">
            Bring calm to your next deal.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-neu-muted">
            Spin up your firm in minutes. Invite your brokers and compliance officers.
            Run a deal end-to-end with a complete audit trail to show for it.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthed ? (
              <PrimaryBtn as={RouterLink} to={dashboardHref}>Open dashboard →</PrimaryBtn>
            ) : (
              <>
                <PrimaryBtn as={RouterLink} to="/login">Get started — it&apos;s free →</PrimaryBtn>
                <SecondaryBtn href="mailto:hello@amldock.app">Talk to us</SecondaryBtn>
              </>
            )}
          </div>

          {/* Trust chips */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
            {['No credit card required', 'Set up in minutes', 'Cancel anytime'].map(text => (
              <span key={text} className="inline-flex items-center gap-2 text-[0.8rem] text-neu-muted">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ boxShadow: EXT_SM }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="#38B2AC" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PrimaryBtn({ as: Tag = 'button', to, href, children }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
      className="inline-flex items-center justify-center rounded-2xl px-7 py-4 text-[0.95rem] font-bold text-white transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-px neu-focus"
      style={{ backgroundColor: '#6C63FF', boxShadow: EXT }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
    >
      {children}
    </Tag>
  );
}

function SecondaryBtn({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-2xl px-7 py-4 text-[0.95rem] font-medium text-neu-fg transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-px neu-focus"
      style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
    >
      {children}
    </a>
  );
}
