// Pricing as shown on /pricing.
//
// TO CONFIRM before launch — none of this is enforced or verifiable in the codebase:
//   • the dollar figures and the per-plan limits (agents, listings per month)
//   • the 14-day trial mentioned in PRICING_NOTE
//   • which modules sit in which plan
// The old page also listed SSO/SAML, custom integrations, an SLA and a "–20% annual" toggle.
// The app has none of those, so they were removed rather than repeated.
export const PRICING_NOTE = 'Prices are in NZD per month, excluding GST. Every plan starts with a 14-day trial.';

export const PLANS = [
  {
    name: 'Basic',
    price: '$49',
    period: 'per month',
    tagline: 'For a single office getting its files in order.',
    features: [
      'Up to 2 agents',
      '20 listings a month',
      'Ownership structures and document uploads',
      'Risk rating on every listing',
      'Email support',
    ],
    cta: 'Book a demo',
    to: '/contact',
  },
  {
    name: 'Standard',
    price: '$129',
    period: 'per month',
    tagline: 'The full set of registers for a working compliance team.',
    featured: true,
    features: [
      'Unlimited agents and listings',
      'Compliance review, sign-off and versions',
      'Beneficial owner, overseas resident and exception registers',
      'Assurance reviews',
      'Staff training records',
      'Reporting registers',
    ],
    cta: 'Book a demo',
    to: '/contact',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: 'For agencies with several branches.',
    features: [
      'Everything in Standard',
      'Multiple branches under one reporting entity',
      'Branch-by-branch notifications',
      'Read-only access for auditors',
      'Help moving your existing files across',
    ],
    cta: 'Talk to us',
    to: '/contact',
  },
];

export const FAQS = [
  {
    q: 'Can we change plans later?',
    a: 'Yes. Move up or down at any time; the change applies from your next billing period.',
  },
  {
    q: 'What counts as a listing?',
    a: 'One property you are engaged to sell, with the customer due diligence that goes with it. A listing that has been closed does not count towards a monthly limit.',
  },
  {
    q: 'How do our staff sign in?',
    a: 'With their work email and a one-time code sent to it. There are no staff passwords to manage or reset.',
  },
  {
    q: 'Who can see a listing?',
    a: 'Agents see their own listings, a sales manager sees their branch, and compliance officers and senior managers see the whole reporting entity. An auditor can be given read-only access.',
  },
  {
    q: 'Where are documents kept?',
    // TO CONFIRM: region taken from the deployment notes (ap-southeast-2).
    a: 'In Amazon Web Services storage in the Sydney region. Files are opened through links that expire after a short time.',
  },
];
