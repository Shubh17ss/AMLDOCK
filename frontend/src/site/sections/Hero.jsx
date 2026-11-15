import { Button } from '../ui/Button.jsx';
import { Rise, Stagger } from '../ui/motion.jsx';

export function Hero({ isAuthed }) {
  return (
    <section className="site-hero">
      <div className="site-plan" aria-hidden="true" />
      <Stagger className="site-wrap site-hero__inner">
        <Rise as="h1" className="site-display" style={{ maxWidth: '11.5em' }}>
          Know who you’re selling for, and be able to show it.
        </Rise>
        <Rise as="p" className="site-lead">
          AMLDOCK is where New Zealand real-estate agencies carry out customer due diligence:
          who owns the property, the documents that prove it, the risk rating, and who signed it off.
        </Rise>
        <Rise className="site-hero__actions">
          {isAuthed ? (
            <Button to="/app">Open dashboard</Button>
          ) : (
            <>
              <Button to="/contact">Book a demo</Button>
              <Button to="/platform" variant="ghost">See the platform</Button>
            </>
          )}
        </Rise>
      </Stagger>
    </section>
  );
}
