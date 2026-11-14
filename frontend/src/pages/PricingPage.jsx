import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { SiteLayout, PageHead } from '../site/SiteLayout.jsx';
import { Button } from '../site/ui/Button.jsx';
import { Check, Plus } from '../site/ui/icons.jsx';
import { PLANS, FAQS, PRICING_NOTE } from '../site/content/pricing.js';
import { EASE } from '../site/tokens.js';

export function PricingPage() {
  return (
    <SiteLayout>
      <PageHead
        title="Priced by the size of your agency."
        lead="Three plans. Start with one office and add branches when you need them."
      />

      <section className="site-section site-section--tight" style={{ paddingTop: 0 }}>
        <div className="site-wrap">
          <div className="site-plans">
            {PLANS.map((plan) => <PlanCard key={plan.name} plan={plan} />)}
          </div>
          <p className="site-body" style={{ marginTop: 20, fontSize: '0.9rem' }}>{PRICING_NOTE}</p>
        </div>
      </section>

      <section className="site-section site-section--ruled">
        <div className="site-wrap">
          <div className="site-group" style={{ borderTop: 0, paddingBlock: 0 }}>
            <div className="site-group__intro">
              <h2 className="site-h2">Questions</h2>
              <p className="site-body">
                Something else? <RouterLink className="site-link" to="/contact">Ask us</RouterLink>.
              </p>
            </div>
            <Faq />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function PlanCard({ plan }) {
  return (
    <div className="site-plan-card" data-featured={Boolean(plan.featured)}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 className="site-h3">{plan.name}</h2>
        <p className="muted">{plan.tagline}</p>
      </div>
      <p className="site-plan-card__price">
        {plan.price}
        {plan.period && <small className="muted">{plan.period}</small>}
      </p>
      <ul>
        {plan.features.map((f) => (
          <li key={f}><Check size={14} /><span>{f}</span></li>
        ))}
      </ul>
      <Button to={plan.to} variant={plan.featured ? 'onDark' : 'ghost'} block>{plan.cta}</Button>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="site-faq">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="site-faq__item">
            <button
              type="button" className="site-faq__q"
              aria-expanded={isOpen} aria-controls={`faq-${i}`}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              {f.q}
              <Plus />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`faq-${i}`} className="site-faq__a"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <p>{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
