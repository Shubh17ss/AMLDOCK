import { SiteLayout, PageHead, useIsAuthed } from '../site/SiteLayout.jsx';
import { Parallax } from '../site/ui/motion.jsx';
import { AuditLogMock } from '../site/mock/Registers.jsx';
import { ClosingCta } from '../site/sections/ClosingCta.jsx';

// Each statement here describes how the application is built. Keep it that way: no
// certifications, audits or guarantees unless they exist. Two things are left out on purpose:
// the hosting provider, and the administrator's separate sign-in.
const TOPICS = [
  {
    id: 'sign-in',
    name: 'Signing in',
    intro: 'No staff passwords to leak, reuse or reset.',
    items: [
      { name: 'One-time codes', desc: 'Staff enter their work email and a six-digit code sent to it. The sign-in page gives the same answer whether or not an address has an account.' },
      { name: 'Sessions', desc: 'The session is held in a cookie that page scripts cannot read and that is only sent over HTTPS.' },
    ],
  },
  {
    id: 'access',
    name: 'Who can see what',
    intro: 'Access is decided by the server, from the person’s role and where they work.',
    items: [
      { name: 'Agents', desc: 'See and edit the listings they opened, until those listings are submitted for review.' },
      { name: 'Branch managers', desc: 'See the listings of their own branch.' },
      { name: 'Compliance officers and senior managers', desc: 'See every branch of their reporting entity, and are the only roles that can verify a file.' },
      { name: 'Auditors', desc: 'Can be given read-only access. They can open everything in scope and change nothing.' },
    ],
  },
  {
    id: 'documents',
    name: 'Documents',
    intro: 'Identity documents are the most sensitive thing in the system.',
    items: [
      { name: 'Storage', desc: 'Files are kept in dedicated file storage, apart from the application database.' },
      { name: 'Expiring links', desc: 'A document is opened through a link created for that request, which stops working shortly afterwards.' },
      { name: 'Review status', desc: 'Each document records whether it has been reviewed, and by whom.' },
    ],
  },
  {
    id: 'record',
    name: 'The record',
    intro: 'What happened, and what was approved, stay answerable later.',
    items: [
      { name: 'Audit log', desc: 'Actions across the workspace are recorded with who did them and when.' },
      { name: 'Versions', desc: 'Verifying a listing saves a numbered copy of the file. Reopening the listing leaves that copy untouched.' },
      { name: 'Reasons on record', desc: 'Overriding a risk rating, accepting an owner on an exception, or putting a listing on hold each ask for a reason, and keep it.' },
    ],
    figure: <AuditLogMock />,
  },
];

export function SecurityPage() {
  const isAuthed = useIsAuthed();
  return (
    <SiteLayout>
      <PageHead
        title="How AMLDOCK looks after what you put in it."
        lead="Your files hold passports, trust deeds and the reasoning behind compliance decisions. This page describes, plainly, how the application handles them."
      />

      <div className="site-wrap">
        {TOPICS.map((t) => (
          <section key={t.id} id={t.id} className="site-group">
            <div className="site-group__intro">
              <h2 className="site-h2">{t.name}</h2>
              <p className="site-body">{t.intro}</p>
            </div>
            <div>
              <div className="site-rows">
                {t.items.map((m) => (
                  <div key={m.name} className="site-row site-row--two">
                    <h3 className="site-h3">{m.name}</h3>
                    <p className="site-row__desc">{m.desc}</p>
                  </div>
                ))}
              </div>
              {t.figure && <Parallax className="site-figure" distance={24}>{t.figure}</Parallax>}
            </div>
          </section>
        ))}
      </div>

      <ClosingCta
        isAuthed={isAuthed}
        title="Have a security questionnaire?"
        body="Send it over. We will answer it against how the system actually works."
      />
    </SiteLayout>
  );
}
