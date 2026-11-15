import { SiteLayout, PageHead, useIsAuthed } from '../site/SiteLayout.jsx';
import { ClosingCta } from '../site/sections/ClosingCta.jsx';
import { LOCATION } from '../site/content/company.js';

// TO CONFIRM: this page is written from what the product is. Company history, the team and
// founding date are not in the codebase — add them here when you have the wording.
const PRINCIPLES = [
  {
    name: 'The file is the register',
    desc: 'Registers are views of the listing files, never a second copy. Do the work once and the beneficial owner, exception and overseas resident registers are already right.',
  },
  {
    name: 'Decisions keep their reasons',
    desc: 'Where someone uses judgement, such as overriding a rating or accepting a gap in the evidence, the system asks why and keeps the answer beside the decision.',
  },
  {
    name: 'A sign-off means what it meant',
    desc: 'A verified file is saved as it stood. Whatever changes afterwards, you can open the version that was approved.',
  },
  {
    name: 'Shaped like an agency',
    desc: 'Reporting entity, branches, sales managers, agents and their assistants. People see the listings they are responsible for and work in the terms they already use.',
  },
];

export function AboutPage() {
  const isAuthed = useIsAuthed();
  return (
    <SiteLayout>
      <PageHead
        title="Built for the way real-estate agencies do AML."
        lead="Since real-estate agents came under the Anti-Money Laundering and Countering Financing of Terrorism Act 2009, every listing has needed a due diligence file behind it. AMLDOCK exists to make that file easy to complete and easy to stand behind."
      />

      <section className="site-section site-section--tight">
        <div className="site-wrap">
          <div className="site-group" style={{ borderTop: 0, paddingTop: 0 }}>
            <div className="site-group__intro">
              <h2 className="site-h2">What we hold to</h2>
              <p className="site-body">Four ideas decide how the product behaves.</p>
            </div>
            <div className="site-rows">
              {PRINCIPLES.map((p) => (
                <div key={p.name} className="site-row site-row--two">
                  <h3 className="site-h3">{p.name}</h3>
                  <p className="site-row__desc">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section site-dark">
        <div className="site-dark__plan" aria-hidden="true" />
        <div className="site-wrap" style={{ display: 'grid', gap: 20 }}>
          <h2 className="site-h1" style={{ maxWidth: '13em' }}>Made in {LOCATION.split(',')[0]}, for agencies across New Zealand.</h2>
          <p className="site-lead">
            The vocabulary, the roles and the registers follow New Zealand’s AML/CFT regime and the way agencies here are organised.
          </p>
        </div>
      </section>

      <ClosingCta isAuthed={isAuthed} title="Talk to the people who build it." body="Tell us how your agency runs due diligence today and we will show you how it would look in AMLDOCK." />
    </SiteLayout>
  );
}
