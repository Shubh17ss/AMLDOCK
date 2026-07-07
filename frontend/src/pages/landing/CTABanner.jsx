import { Link as RouterLink } from 'react-router-dom';
import { CLR, SH } from './clr.js';
import { Reveal } from './reveal.jsx';

export function CTABanner({ isAuthed, dashboardHref }) {
  return (
    <section id="contact" className="py-24 px-6 md:py-28">
      <Reveal
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] p-14 sm:p-20"
        style={{ background: `linear-gradient(140deg, ${CLR.blue} 0%, ${CLR.blueDark} 100%)`, boxShadow: SH.lg }}
      >
        {/* Ambient depth — soft glow + concentric hairline rings, no neumorphism */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full"
          aria-hidden="true"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
        />
        <div className="pointer-events-none absolute -bottom-28 -left-24 opacity-60" aria-hidden="true">
          <div className="h-72 w-72 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
            <div className="m-10 h-52 w-52 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
          </div>
        </div>

        {/* Content */}
        <div className="relative text-center">
          {/* Ledger eyebrow */}
          <div
            className="clr-eyebrow inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6"
            style={{ backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#fff' }} />
            Ready when you are
          </div>

          <h2 className="font-grotesk text-3xl font-extrabold sm:text-5xl" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
            Compliant Deals — Without Hassle
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
            Spin up your firm in minutes. Invite your brokers and compliance officers.
            Run a deal end-to-end with a complete audit trail to show for it.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {isAuthed ? (
              <PrimaryBtn as={RouterLink} to={dashboardHref}>Open dashboard →</PrimaryBtn>
            ) : (
              <>
                <PrimaryBtn as={RouterLink} to="/login">Get started</PrimaryBtn>
                <GhostBtn as={RouterLink} to="/contact">Talk to us</GhostBtn>
              </>
            )}
          </div>

          {/* Trust chips */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
            {['No credit card required', 'Set up in minutes', 'Cancel anytime'].map(text => (
              <span key={text} className="inline-flex items-center gap-2 text-[0.8rem]" style={{ color: 'rgba(255,255,255,0.82)' }}>
                <svg width="13" height="13" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {text}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function PrimaryBtn({ as: Tag = 'button', to, href, children }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
      className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-[0.95rem] font-semibold transition-all duration-200 clr-focus"
      style={{ backgroundColor: '#fff', color: CLR.blueDark, boxShadow: SH.md }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = SH.lg; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = SH.md; }}
    >
      {children}
    </Tag>
  );
}

function GhostBtn({ as: Tag = 'a', to, href, children }) {
  const props = to ? { to } : href ? { href } : {};
  return (
    <Tag
      {...props}
      className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-[0.95rem] font-semibold transition-colors duration-200 clr-focus"
      style={{ backgroundColor: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {children}
    </Tag>
  );
}
