import { Button } from '../ui/Button.jsx';

export function ClosingCta({ isAuthed, title = 'Walk through a listing with us.', body }) {
  return (
    <section className="site-section site-section--wash site-section--ruled">
      <div className="site-wrap site-cta">
        <div style={{ display: 'grid', gap: 16 }}>
          <h2 className="site-h1" style={{ maxWidth: '12em' }}>{title}</h2>
          <p className="site-lead">
            {body || 'Half an hour, one sample listing, start to sign-off. Bring the questions your supervisor asks you.'}
          </p>
        </div>
        <div className="site-cta__actions">
          {isAuthed ? (
            <Button to="/app">Open dashboard</Button>
          ) : (
            <>
              <Button to="/contact">Book a demo</Button>
              <Button to="/login" variant="ghost">Sign in</Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
