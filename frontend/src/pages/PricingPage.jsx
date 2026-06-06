import { useAuth } from '../auth/AuthContext.jsx';
import { Link as RouterLink } from 'react-router-dom';
import '../landing.css';
import { Navbar } from './landing/Navbar.jsx';
import { Footer } from './landing/Footer.jsx';

const EXT      = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_H    = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)';
const EXT_SM   = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET    = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';
const INSET_SM = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const PLANS = [
  {
    name: 'Basic',
    price: '$49',
    period: '/mo',
    tagline: 'For small firms just getting started.',
    color: '#3D4852',
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
    color: '#6C63FF',
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
    color: '#38B2AC',
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

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M3 8l3 3 7-7" stroke="#38B2AC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function PricingPage() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authed' && user;

  return (
    <div className="relative min-h-screen font-body text-neu-fg" style={{ backgroundColor: '#E0E5EC' }}>
      <Navbar isAuthed={isAuthed} dashboardHref="/app" />

      <main>
        {/* Hero header */}
        <section className="py-20 px-6 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] mb-6"
            style={{ boxShadow: INSET_SM, color: '#6C63FF' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#38B2AC' }} />
            Simple, transparent pricing
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-neu-fg sm:text-5xl mb-4">
            Plans that grow with you
          </h1>
          <p className="mx-auto max-w-lg text-[1.05rem] leading-relaxed text-neu-muted">
            No lock-in, no hidden fees. Cancel or upgrade anytime.
            All plans include a 14-day free trial.
          </p>

          {/* Billing toggle pill */}
          <div
            className="mt-8 inline-flex items-center gap-1 rounded-full p-1 text-sm"
            style={{ boxShadow: INSET_SM }}
          >
            <span
              className="rounded-full px-5 py-2 font-semibold text-white text-[0.85rem]"
              style={{ backgroundColor: '#6C63FF', boxShadow: EXT_SM }}
            >
              Monthly
            </span>
            <span className="rounded-full px-5 py-2 font-medium text-neu-muted text-[0.85rem]">
              Annual <span className="text-[0.72rem] text-[#38B2AC] font-semibold">–20%</span>
            </span>
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
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-neu-fg text-center mb-10">
              Common questions
            </h2>
            <div className="flex flex-col gap-4">
              {FAQS.map((faq) => (
                <FaqItem key={faq.q} faq={faq} />
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

  return (
    <div
      className="relative flex flex-col rounded-[32px] p-7 transition duration-300 ease-out"
      style={{
        backgroundColor: '#E0E5EC',
        boxShadow: isFeatured ? EXT_H : EXT,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = EXT_H; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isFeatured ? EXT_H : EXT; }}
    >
      {/* Popular badge */}
      {isFeatured && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white whitespace-nowrap"
          style={{ backgroundColor: '#6C63FF', boxShadow: EXT_SM }}
        >
          Most popular
        </div>
      )}

      {/* Plan header */}
      <div className="mb-6">
        {/* Name pill */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] mb-4"
          style={{ boxShadow: INSET_SM, color: plan.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: plan.color }} />
          {plan.name}
        </div>

        {/* Price */}
        <div className="flex items-end gap-1 mb-2">
          <span
            className="font-display text-4xl font-extrabold tracking-tight"
            style={{ color: plan.color }}
          >
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-neu-muted text-[0.9rem] mb-1">{plan.period}</span>
          )}
        </div>
        <p className="text-[0.88rem] leading-relaxed text-neu-muted">{plan.tagline}</p>
      </div>

      {/* Divider well */}
      <div className="mb-6 h-px" style={{ boxShadow: INSET_SM, height: 1 }} />

      {/* Features */}
      <ul className="flex flex-col gap-3 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[0.88rem] text-neu-fg">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ boxShadow: EXT_SM }}
            >
              {CHECK}
            </span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isFeatured ? (
        <RouterLink
          to={plan.ctaTo}
          className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-[0.9rem] font-bold text-white transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-px"
          style={{ backgroundColor: '#6C63FF', boxShadow: EXT }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = EXT_H; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
        >
          {plan.cta} →
        </RouterLink>
      ) : (
        <RouterLink
          to={plan.ctaTo}
          className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-[0.9rem] font-semibold text-neu-fg transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-px"
          style={{ backgroundColor: '#E0E5EC', boxShadow: EXT }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = EXT_H; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
        >
          {plan.cta} →
        </RouterLink>
      )}
    </div>
  );
}

function FaqItem({ faq }) {
  return (
    <div className="rounded-2xl p-5" style={{ boxShadow: EXT }}>
      <p className="font-semibold text-neu-fg text-[0.92rem] mb-1.5">{faq.q}</p>
      <p className="text-[0.87rem] leading-relaxed text-neu-muted">{faq.a}</p>
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
