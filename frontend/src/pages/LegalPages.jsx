import { SiteLayout, PageHead } from '../site/SiteLayout.jsx';
import { PRIVACY, TERMS, LAST_UPDATED } from '../site/content/legal.js';

/** A legal document: contents on the left on wide screens, numbered clauses on the right. */
function LegalPage({ title, lead, clauses }) {
  return (
    <SiteLayout>
      <PageHead title={title} lead={lead}>
        <p className="site-body" style={{ fontSize: '0.9rem' }}>Last updated {LAST_UPDATED}</p>
      </PageHead>

      <div className="site-wrap site-legal">
        <nav className="site-legal__toc" aria-label="Contents">
          <ol>
            {clauses.map((c) => (
              <li key={c.id}><a href={`#${c.id}`}>{c.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="site-legal__body">
          {clauses.map((c) => (
            <section key={c.id} id={c.id}>
              <h2>{c.title}</h2>
              {c.blocks.map((b, i) => <Block key={i} block={b} />)}
            </section>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}

/** A paragraph, a bullet list, or a sentence ending in an email link. */
function Block({ block }) {
  if (Array.isArray(block)) {
    return <ul>{block.map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  if (typeof block === 'object') {
    return <p>{block.text} <a href={`mailto:${block.email}`}>{block.email}</a>.</p>;
  }
  return <p>{block}</p>;
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      lead="What personal information AMLDOCK handles, why, and the choices you have."
      clauses={PRIVACY}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms and conditions"
      lead="The terms that apply when you use the AMLDOCK website and product."
      clauses={TERMS}
    />
  );
}
