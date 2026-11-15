import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { SiteLayout, PageHead } from '../site/SiteLayout.jsx';
import { Button } from '../site/ui/Button.jsx';
import { Check } from '../site/ui/icons.jsx';
import { CONTACT_EMAIL, LOCATION } from '../site/content/company.js';

const EMPTY = { name: '', email: '', agency: '', message: '' };

export function ContactPage() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // NOTE: nothing is sent. There is no contact endpoint yet, so submitting only shows the
  // confirmation. Wire this to the backend before relying on the form for enquiries.
  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  const incomplete = !form.name || !form.email || !form.message;

  return (
    <SiteLayout>
      <PageHead
        title="Book a demo, or ask us anything."
        lead="Tell us a little about your agency. We reply within one business day."
      />

      <section className="site-section site-section--tight" style={{ paddingTop: 0 }}>
        <div className="site-wrap site-contact">
          <dl className="site-dl">
            <div>
              <dt>Email</dt>
              <dd><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd>
            </div>
            <div>
              <dt>Where we are</dt>
              <dd>{LOCATION}</dd>
            </div>
            <div>
              <dt>Already a customer?</dt>
              <dd><RouterLink className="site-link" to="/login">Sign in</RouterLink></dd>
            </div>
          </dl>

          {sent ? (
            <div className="site-sent" role="status">
              <span className="site-sent__mark"><Check size={20} /></span>
              <h2 className="site-h2">Message sent</h2>
              <p className="site-body">Thanks, {form.name.split(' ')[0]}. We will reply to {form.email} within one business day.</p>
              <Button variant="ghost" onClick={() => { setSent(false); setForm(EMPTY); }}>Send another message</Button>
            </div>
          ) : (
            <form className="site-form" onSubmit={handleSubmit}>
              <div className="site-form__two">
                <div className="site-field">
                  <label htmlFor="c-name">Your name</label>
                  <input id="c-name" name="name" type="text" autoComplete="name" required value={form.name} onChange={handleChange} />
                </div>
                <div className="site-field">
                  <label htmlFor="c-email">Work email</label>
                  <input id="c-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={handleChange} />
                </div>
              </div>
              <div className="site-field">
                <label htmlFor="c-agency">Agency</label>
                <input id="c-agency" name="agency" type="text" autoComplete="organization" value={form.agency} onChange={handleChange} />
              </div>
              <div className="site-field">
                <label htmlFor="c-message">How can we help?</label>
                <textarea
                  id="c-message" name="message" rows={6} required
                  placeholder="For example: how many branches you have and how you keep due diligence files today."
                  value={form.message} onChange={handleChange}
                />
              </div>
              <div>
                <Button type="submit" disabled={incomplete}>Send message</Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
