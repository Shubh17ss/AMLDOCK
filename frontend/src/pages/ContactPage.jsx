import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import '../landing.css';
import { Navbar } from './landing/Navbar.jsx';
import { Footer } from './landing/Footer.jsx';
import { CLR, SH } from './landing/clr.js';

const CONTACT_ITEMS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"
          fill="rgba(27,95,227,0.10)" stroke={CLR.blue} strokeWidth="1.5" />
        <path d="M3 7l7 5 7-5" stroke={CLR.blue} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    label: 'Email us',
    value: 'contact@amldock.com',
    href: 'mailto:hello@amldock.app',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2C6.686 2 4 4.686 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z"
          fill="rgba(27,95,227,0.10)" stroke={CLR.blue} strokeWidth="1.5" />
        <circle cx="10" cy="8" r="2" stroke={CLR.blue} strokeWidth="1.5" />
      </svg>
    ),
    label: 'Location',
    value: 'Auckland, New Zealand',
    href: null,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" fill="rgba(27,95,227,0.10)" stroke={CLR.blue} strokeWidth="1.5" />
        <path d="M10 6v4l2.5 2.5" stroke={CLR.blue} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    label: 'Response time',
    value: 'Within one business day',
    href: null,
  },
];

export function ContactPage() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authed' && user;

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  const inputStyle = (field) => ({
    width: '100%',
    backgroundColor: '#fff',
    border: `1px solid ${focused === field ? CLR.blue : CLR.hairline2}`,
    outline: 'none',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: '0.9rem',
    color: CLR.ink,
    fontFamily: 'inherit',
    resize: 'none',
    boxShadow: focused === field ? SH.focus : 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  });

  return (
    <div className="relative min-h-screen font-body" style={{ backgroundColor: '#FFFFFF', color: CLR.ink }}>
      <Navbar isAuthed={isAuthed} dashboardHref="/app" />

      <main style={{height:'100vh'}}>
        {/* Header */}
        <section className="relative overflow-hidden py-20 px-6 text-center">
          <div className="clr-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <div
              className="clr-eyebrow inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6"
              style={{ backgroundColor: CLR.blueWash, color: CLR.blueDark }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLR.blue }} />
              Get in touch
            </div>
            <h1 className="font-grotesk text-4xl font-extrabold sm:text-5xl mb-4" style={{ color: CLR.ink, letterSpacing: '-0.035em' }}>
              We&apos;d love to hear from you
            </h1>
            <p className="mx-auto max-w-md text-[1.05rem] leading-relaxed" style={{ color: CLR.muted }}>
              Questions about pricing, a demo request, or anything else —
              send us a message and we&apos;ll get back to you quickly.
            </p>
          </div>
        </section>

        {/* Main content */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-5">

            {/* Left — contact details */}
            <div className="md:col-span-2 flex flex-col gap-4">
              {CONTACT_ITEMS.map((item) => (
                <div key={item.label} className="clr-card flex items-start gap-4 rounded-2xl p-5">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: CLR.blueWash }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="clr-eyebrow mb-1" style={{ fontSize: '0.62rem' }}>{item.label}</p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-[0.9rem] font-medium transition-colors"
                        style={{ color: CLR.ink }}
                        onMouseEnter={e => { e.currentTarget.style.color = CLR.blue; }}
                        onMouseLeave={e => { e.currentTarget.style.color = CLR.ink; }}
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-[0.9rem] font-medium" style={{ color: CLR.ink }}>{item.value}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Assurance note — replaces the neumorphic decorative circles */}
              <div
                className="rounded-2xl p-5"
                style={{ background: `linear-gradient(140deg, ${CLR.blue} 0%, ${CLR.blueDark} 100%)`, boxShadow: SH.md }}
              >
                <p className="clr-eyebrow mb-2" style={{ color: 'rgba(255,255,255,0.8)' }}>Confidential</p>
                <p className="text-[0.86rem] leading-relaxed" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  Your message reaches our NZ-based team directly. We never share your details,
                  and there&apos;s no sales sequence waiting on the other side.
                </p>
              </div>
            </div>

            {/* Right — form */}
            <div className="md:col-span-3 flex">
              <div className="clr-card rounded-3xl p-8 w-full h-full flex flex-col" style={{ boxShadow: SH.md }}>
                {sent ? (
                  <SuccessState onReset={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }} />
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
                    <div className="grid gap-5 sm:grid-cols-2">
                      {/* Name */}
                      <Field label="Full name">
                        <input
                          name="name" type="text" required placeholder=""
                          value={form.name} onChange={handleChange}
                          onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                          style={inputStyle('name')}
                        />
                      </Field>

                      {/* Email */}
                      <Field label="Email address">
                        <input
                          name="email" type="email" required placeholder=""
                          value={form.email} onChange={handleChange}
                          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                          style={inputStyle('email')}
                        />
                      </Field>

                      {/* Subject */}
                      <Field label="Subject" full>
                        <input
                          name="subject" type="text" placeholder=""
                          value={form.subject} onChange={handleChange}
                          onFocus={() => setFocused('subject')} onBlur={() => setFocused(null)}
                          style={inputStyle('subject')}
                        />
                      </Field>
                    </div>

                    {/* Message — grows to absorb the extra card height */}
                    <div className="mt-5 flex flex-1 flex-col gap-1.5">
                      <label className="clr-eyebrow" style={{ fontSize: '0.64rem' }}>Message</label>
                      <textarea
                        name="message" required
                        placeholder="Tell us about your firm and how we can help…"
                        value={form.message} onChange={handleChange}
                        onFocus={() => setFocused('message')} onBlur={() => setFocused(null)}
                        style={{ ...inputStyle('message'), flex: 1, minHeight: 150 }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!form.name || !form.email || !form.message}
                      className="mt-6 inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-[0.92rem] font-semibold text-white transition-all duration-200 clr-focus disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: (!form.name || !form.email || !form.message) ? '#C5D2EC' : CLR.blue,
                        boxShadow: SH.sm,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.backgroundColor = CLR.blueDark; e.currentTarget.style.boxShadow = SH.md; } }}
                      onMouseLeave={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.backgroundColor = CLR.blue; e.currentTarget.style.boxShadow = SH.sm; } }}
                    >
                      Send message →
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="clr-eyebrow" style={{ fontSize: '0.64rem' }}>{label}</label>
      {children}
    </div>
  );
}

function SuccessState({ onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
      {/* Success mark */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: '#E6F4EC' }}>
        <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
          <path d="M5 14l6 6 12-12" stroke={CLR.approved} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h3 className="font-grotesk text-xl font-bold mb-2" style={{ color: CLR.ink, letterSpacing: '-0.02em' }}>Message sent</h3>
        <p className="text-[0.9rem] max-w-xs" style={{ color: CLR.muted }}>
          Thanks for reaching out. We&apos;ll get back to you within one business day.
        </p>
      </div>
      <button
        onClick={onReset}
        className="rounded-xl px-6 py-3 text-[0.88rem] font-semibold transition-colors duration-200 clr-focus"
        style={{ backgroundColor: '#fff', color: CLR.ink, border: `1px solid ${CLR.hairline2}`, cursor: 'pointer', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = CLR.blue; e.currentTarget.style.backgroundColor = CLR.blueWash; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = CLR.hairline2; e.currentTarget.style.backgroundColor = '#fff'; }}
      >
        Send another
      </button>
    </div>
  );
}
