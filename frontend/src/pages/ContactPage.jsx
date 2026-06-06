import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import '../landing.css';
import { Navbar } from './landing/Navbar.jsx';
import { Footer } from './landing/Footer.jsx';

const EXT      = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_H    = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)';
const EXT_SM   = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET    = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';
const INSET_D  = 'inset 10px 10px 20px rgb(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)';
const INSET_SM = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const CONTACT_ITEMS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"
          fill="rgba(108,99,255,0.12)" stroke="#6C63FF" strokeWidth="1.5" />
        <path d="M3 7l7 5 7-5" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    label: 'Email us',
    value: 'hello@amldock.app',
    href: 'mailto:hello@amldock.app',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2C6.686 2 4 4.686 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z"
          fill="rgba(56,178,172,0.12)" stroke="#38B2AC" strokeWidth="1.5" />
        <circle cx="10" cy="8" r="2" stroke="#38B2AC" strokeWidth="1.5" />
      </svg>
    ),
    label: 'Location',
    value: 'Auckland, New Zealand',
    href: null,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" fill="rgba(108,99,255,0.12)" stroke="#6C63FF" strokeWidth="1.5" />
        <path d="M10 6v4l2.5 2.5" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" />
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

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  const inputStyle = (field) => ({
    width: '100%',
    backgroundColor: '#E0E5EC',
    border: 'none',
    outline: 'none',
    borderRadius: 14,
    padding: '12px 16px',
    fontSize: '0.9rem',
    color: '#3D4852',
    fontFamily: 'inherit',
    resize: 'none',
    boxShadow: focused === field
      ? `${INSET_D}, 0 0 0 2px #E0E5EC, 0 0 0 4px #6C63FF`
      : INSET,
    transition: 'box-shadow 0.25s ease',
  });

  return (
    <div className="relative min-h-screen font-body text-neu-fg" style={{ backgroundColor: '#E0E5EC' }}>
      <Navbar isAuthed={isAuthed} dashboardHref="/app" />

      <main>
        {/* Header */}
        <section className="py-20 px-6 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] mb-6"
            style={{ boxShadow: INSET_SM, color: '#6C63FF' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#38B2AC' }} />
            Get in touch
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-neu-fg sm:text-5xl mb-4">
            We&apos;d love to hear from you
          </h1>
          <p className="mx-auto max-w-md text-[1.05rem] leading-relaxed text-neu-muted">
            Questions about pricing, a demo request, or anything else —
            send us a message and we&apos;ll get back to you quickly.
          </p>
        </section>

        {/* Main content */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl grid gap-8 md:grid-cols-5">

            {/* Left — contact details */}
            <div className="md:col-span-2 flex flex-col gap-5">
              {CONTACT_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-4 rounded-[24px] p-5"
                  style={{ boxShadow: EXT }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ boxShadow: INSET_SM }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-neu-muted mb-0.5">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-[0.9rem] font-medium text-neu-fg hover:text-[#6C63FF] transition-colors"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-[0.9rem] font-medium text-neu-fg">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Decorative circles */}
              <div className="flex items-center justify-center pt-4" aria-hidden="true">
                <div className="flex h-32 w-32 items-center justify-center rounded-full" style={{ boxShadow: INSET }}>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ boxShadow: EXT }}>
                    <div className="h-10 w-10 rounded-full" style={{ boxShadow: INSET_SM }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right — form */}
            <div className="md:col-span-3">
              <div className="rounded-[32px] p-8" style={{ boxShadow: EXT }}>
                {sent ? (
                  <SuccessState onReset={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }} />
                ) : (
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {/* Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-neu-muted">
                          Full name
                        </label>
                        <input
                          name="name"
                          type="text"
                          required
                          placeholder="Jane Smith"
                          value={form.name}
                          onChange={handleChange}
                          onFocus={() => setFocused('name')}
                          onBlur={() => setFocused(null)}
                          style={inputStyle('name')}
                        />
                      </div>

                      {/* Email */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-neu-muted">
                          Email address
                        </label>
                        <input
                          name="email"
                          type="email"
                          required
                          placeholder="jane@firm.co.nz"
                          value={form.email}
                          onChange={handleChange}
                          onFocus={() => setFocused('email')}
                          onBlur={() => setFocused(null)}
                          style={inputStyle('email')}
                        />
                      </div>

                      {/* Subject */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-neu-muted">
                          Subject
                        </label>
                        <input
                          name="subject"
                          type="text"
                          placeholder="e.g. Demo request, pricing question…"
                          value={form.subject}
                          onChange={handleChange}
                          onFocus={() => setFocused('subject')}
                          onBlur={() => setFocused(null)}
                          style={inputStyle('subject')}
                        />
                      </div>

                      {/* Message */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-neu-muted">
                          Message
                        </label>
                        <textarea
                          name="message"
                          required
                          rows={6}
                          placeholder="Tell us about your firm and how we can help…"
                          value={form.message}
                          onChange={handleChange}
                          onFocus={() => setFocused('message')}
                          onBlur={() => setFocused(null)}
                          style={inputStyle('message')}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!form.name || !form.email || !form.message}
                      className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-[0.9rem] font-bold text-white transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                      style={{
                        backgroundColor: '#6C63FF',
                        boxShadow: EXT,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = EXT_H; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
                      onMouseDown={e => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = 'inset 4px 4px 8px rgba(73,65,204,0.4), inset -4px -4px 8px rgba(255,255,255,0.15)'; }}
                      onMouseUp={e => { e.currentTarget.style.boxShadow = EXT; }}
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

function SuccessState({ onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
      {/* Animated check circle */}
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{ boxShadow: EXT }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ boxShadow: INSET }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14l6 6 12-12" stroke="#38B2AC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div>
        <h3 className="font-display text-xl font-bold text-neu-fg mb-2">Message sent!</h3>
        <p className="text-[0.9rem] text-neu-muted max-w-xs">
          Thanks for reaching out. We&apos;ll get back to you within one business day.
        </p>
      </div>
      <button
        onClick={onReset}
        className="rounded-2xl px-6 py-3 text-[0.88rem] font-semibold text-neu-fg transition duration-300 ease-out hover:-translate-y-0.5"
        style={{ backgroundColor: '#E0E5EC', boxShadow: EXT, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = EXT_H; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = EXT; }}
      >
        Send another
      </button>
    </div>
  );
}
