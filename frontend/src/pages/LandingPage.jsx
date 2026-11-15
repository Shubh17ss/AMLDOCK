import { SiteLayout, useIsAuthed } from '../site/SiteLayout.jsx';
import { Hero } from '../site/sections/Hero.jsx';
import { DealLifecycle } from '../site/sections/DealLifecycle.jsx';
import { Roles } from '../site/sections/Roles.jsx';
import { Modules } from '../site/sections/Modules.jsx';
import { SecurityStrip } from '../site/sections/SecurityStrip.jsx';
import { ClosingCta } from '../site/sections/ClosingCta.jsx';

export function LandingPage() {
  const isAuthed = useIsAuthed();
  return (
    <SiteLayout>
      <Hero isAuthed={isAuthed} />
      <DealLifecycle />
      <Roles />
      <Modules />
      <SecurityStrip />
      <ClosingCta isAuthed={isAuthed} />
    </SiteLayout>
  );
}
