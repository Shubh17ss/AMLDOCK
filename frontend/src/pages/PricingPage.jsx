import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Link as RouterLink } from 'react-router-dom';
import '../landing.css';
import { Navbar } from './landing/Navbar.jsx';
import { Footer } from './landing/Footer.jsx';
import { CLR, SH } from './landing/clr.js';

const PLANS = [
  {
    name: 'Basic',
    price: '$49',
    period: '/mo',
    tagline: 'For small firms just getting started.',
    features: [
      'Up to 2 brokers',
      '20 deals / month',
      'Document uploads',
      'Ownership tree',
      'Basic audit log',
      'Email support',
    ],
    cta: 'Get started',
    ctaTo: '/login',
    featured: false,
  },
  {
    name: 'Standard',
    price: '$129',
    period: '/mo',
    tagline: 'The full toolkit for growing compliance teams.',
    features: [
      'Unlimited brokers',
      'Unlimited deals',
      'Everything in Basic',
      'Compliance queue',
      'LINZ / NZBN checks',
      'Manager overrides & notes',
      'Full audit trail export',
      'Priority support',
    ],
    cta: 'Start free trial',
    ctaTo: '/login',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: 'Tailored for multi-branch firms & networks.',
    features: [
      'Everything in Standard',
      'Multi-branch management',
      'Custom integrations',
      'SSO / SAML',
      'Dedicated onboarding',
      'SLA guarantee',
    ],
    cta: 'Contact sales',
    ctaTo: '/contact',
    featured: false,
  },
];

function Check({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 8l3 3 7-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PricingPage() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authed' && user;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="relative min-h-screen font-body" style={{ backgroundColor: '#FFFFFF', color: CLR.ink }}>
      <Navbar isAuthed={isAuthed} dashboardHref="/app" />

      <main>
        {/* Hero header */}
        <section className="relative overflow-hidden py-20 px-6 text-center">
          <div className="clr-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <div
              className="clr-eyebrow inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6"
              style={{ backgroundColor: CLR.blueWash, color: CLR.blueDark }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLR.blue }} />
              Simple, transparent pricing
            </div>
            <h1 className="font-grotesk text-4xl font-extrabold sm:text-5xl mb-4" style={{ color: CLR.ink, letterSpacing: '-0.035em' }}>
              Plans that grow with you
            </h1>
            <p className="mx-auto max-w-lg text-[1.05rem] leading-relaxed" style={{ color: CLR.muted }}>
              No lock-in, no hidden fees. Cancel or upgrade anytime.
              All plans include a 14-day free trial.
            </p>

            {/* Billing toggle — segmented control (matches app tabs) */}
            <div
              className="mt-8 inline-flex items-center gap-1 rounded-full p-1 text-sm"
              style={{ backgroundColor: '#F1F4F9' }}
            >
              <span
                className="rounded-full px-5 py-2 font-semibold text-[0.85rem]"
                style={{ backgroundColor: '#fff', color: CLR.ink, boxShadow: SH.sm }}
              >
                Monthly
              </span>
              <span className="rounded-full px-5 py-2 font-medium text-[0.85rem]" style={{ color: CLR.muted }}>
                Annual <span className="text-[0.72rem] font-semibold" style={{ color: CLR.approved }}>–20%</span>
              </span>
            </div>
          </div>
        </section>

        {/* Plan cards */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-3 items-start">
            {PLANS.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        {/* FAQ strip */}
        <section className="px-6 pb-24" style={{ borderTop: `1px solid ${CLR.hairline}`, paddingTop: 80 }}>
          <div className="mx-auto max-w-3xl">
            <h2 className="font-grotesk text-2xl font-bold text-center mb-10" style={{ color: CLR.ink, letterSpacing: '-0.02em' }}>
              Common questions
            </h2>
            <div className="flex flex-col gap-4">
              {FAQS.map((faq) => (
                <div key={faq.q} className="clr-card rounded-2xl p-5">
                  <p className="font-semibold text-[0.92rem] mb-1.5" style={{ color: CLR.ink }}>{faq.q}</p>
                  <p className="text-[0.87rem] leading-relaxed" style={{ color: CLR.muted }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function PlanCard({ plan }) {
  const isFeatured = plan.featured;
  const accent = isFeatured ? CLR.blue : CLR.ink;

  return (
    <div
      className="clr-card clr-lift relative flex flex-col rounded-3xl p-7"
      style={isFeatured
        ? { borderColor: CLR.blue, boxShadow: SH.lg, borderWidth: 1.5 }
        : undefined}
    >
      {/* Popular badge */}
      {isFeatured && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white whitespace-nowrap"
          style={{ backgroundColor: CLR.blue, boxShadow: SH.sm, fontFamily: '"FK Grotesk Mono Trial", monospace' }}
        >
          Most popular
        </div>
      )}

      {/* Plan header */}
      <div className="mb-6">
        {/* Name pill */}
        <div
          className="clr-eyebrow inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4"
          style={{ backgroundColor: isFeatured ? CLR.blueWash : '#EEF1F6', color: isFeatured ? CLR.blueDark : CLR.muted }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          {plan.name}
        </div>

        {/* Price */}
        <div className="flex items-end gap-1 mb-2">
          <span className="font-grotesk text-4xl font-extrabold tracking-tight" style={{ color: CLR.ink, letterSpacing: '-0.03em' }}>
            {plan.price}
          </span>
          {plan.period && <span className="text-[0.9rem] mb-1" style={{ color: CLR.muted }}>{plan.period}</span>}
        </div>
        <p className="text-[0.88rem] leading-relaxed" style={{ color: CLR.muted }}>{plan.tagline}</p>
      </div>

      {/* Divider */}
      <div className="mb-6" style={{ height: 1, backgroundColor: CLR.hairline }} />

      {/* Features */}
      <ul className="flex flex-col gap-3 mb-8 flex-1 list-none p-0">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[0.88rem]" style={{ color: CLR.ink }}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: CLR.blueWash }}>
              <Check color={CLR.blue} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isFeatured ? (
        <RouterLink
          to={plan.ctaTo}
          className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-[0.9rem] font-semibold text-white transition-all duration-200 clr-focus"
          style={{ backgroundColor: CLR.blue, boxShadow: SH.sm }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = CLR.blueDark; e.currentTarget.style.boxShadow = SH.md; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = CLR.blue; e.currentTarget.style.boxShadow = SH.sm; }}
        >
          {plan.cta} →
        </RouterLink>
      ) : (
        <RouterLink
          to={plan.ctaTo}
          className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-[0.9rem] font-semibold transition-colors duration-200 clr-focus"
          style={{ backgroundColor: '#fff', color: CLR.ink, border: `1px solid ${CLR.hairline2}` }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = CLR.blue; e.currentTarget.style.backgroundColor = CLR.blueWash; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = CLR.hairline2; e.currentTarget.style.backgroundColor = '#fff'; }}
        >
          {plan.cta} →
        </RouterLink>
      )}
    </div>
  );
}

const FAQS = [
  {
    q: 'Can I change plans later?',
    a: 'Yes — upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'None. Spin up your firm, invite your team, and run your first deal — all within the trial period at no cost.',
  },
  {
    q: 'What counts as a "deal"?',
    a: 'A deal is a single real-estate transaction record. Archived deals do not count toward your monthly limit.',
  },
  {
    q: 'Do you offer NZ-based data hosting?',
    a: 'Yes. All customer data is stored in AWS ap-southeast-2 (Sydney) with optional NZ residency on the Enterprise plan.',
  },
];
