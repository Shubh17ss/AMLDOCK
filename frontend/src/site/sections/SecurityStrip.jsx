import { Link as RouterLink } from 'react-router-dom';

const FACTS = [
  { head: 'Sign-in by one-time code', body: 'Staff sign in with a code sent to their work email. Administrators use a password and a code.' },
  { head: 'Access by role and branch', body: 'What someone can open is decided on the server from their role and where they work.' },
  { head: 'Documents behind expiring links', body: 'Passports and deeds are opened through links that stop working after a short time.' },
  { head: 'Sign-offs that cannot drift', body: 'A verified file is stored as its own version, so later edits never rewrite what was approved.' },
];

export function SecurityStrip() {
  return (
    <section className="site-section site-dark">
      <div className="site-dark__plan" aria-hidden="true" />
      <div className="site-wrap">
        <div className="site-head site-head--split">
          <h2 className="site-h2">These files hold passports and trust deeds. They are treated that way.</h2>
          <p className="site-lead">
            <RouterLink to="/security" className="site-link">How AMLDOCK handles your data</RouterLink>
          </p>
        </div>
        <div className="site-facts">
          {FACTS.map((f) => (
            <div key={f.head} className="site-fact">
              <h3 className="site-h3">{f.head}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
