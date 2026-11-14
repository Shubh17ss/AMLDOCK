import { SiteLayout, PageHead, useIsAuthed } from '../site/SiteLayout.jsx';
import { MODULE_GROUPS } from '../site/content/modules.js';
import { Parallax } from '../site/ui/motion.jsx';
import { ListingRegisterMock, BeneficialOwnersMock, AuditLogMock } from '../site/mock/Registers.jsx';
import { ClosingCta } from '../site/sections/ClosingCta.jsx';

// A screen to go with the groups where seeing it helps; the rest are plain lists.
const FIGURES = {
  cdd: (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
      <ListingRegisterMock />
      <BeneficialOwnersMock />
    </div>
  ),
  oversight: <AuditLogMock />,
};

export function PlatformPage() {
  const isAuthed = useIsAuthed();
  return (
    <SiteLayout>
      <PageHead
        title="Everything an agency keeps for AML, in one place."
        lead="AMLDOCK follows the shape of an AML/CFT programme: due diligence on every listing, the programme documents, staff training, reporting, and a record of who did what."
      />

      <div className="site-wrap">
        {MODULE_GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="site-group">
            <div className="site-group__intro">
              <h2 className="site-h2">{g.name}</h2>
              <p className="site-body">{g.intro}</p>
            </div>
            <div>
              <div className="site-rows">
                {g.modules.map((m) => (
                  <div key={m.name} className="site-row site-row--two">
                    <h3 className="site-h3">{m.name}</h3>
                    <p className="site-row__desc">{m.desc}</p>
                  </div>
                ))}
              </div>
              {FIGURES[g.id] && (
                <Parallax className="site-figure" distance={24}>{FIGURES[g.id]}</Parallax>
              )}
            </div>
          </section>
        ))}
      </div>

      <ClosingCta isAuthed={isAuthed} title="See these registers filled in." />
    </SiteLayout>
  );
}
