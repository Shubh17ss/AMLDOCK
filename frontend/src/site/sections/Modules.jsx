import { Link as RouterLink } from 'react-router-dom';
import { MODULE_GROUPS } from '../content/modules.js';

/** Home-page summary: one row per menu group, linking through to the full tour. */
export function Modules() {
  return (
    <section className="site-section site-section--ruled">
      <div className="site-wrap">
        <div className="site-head site-head--split">
          <h2 className="site-h2">The registers a supervisor asks for, already kept.</h2>
          <p className="site-lead">
            Because the registers are drawn from the listing files themselves, they are current
            the moment the work is done. Nothing is copied into a spreadsheet afterwards.
          </p>
        </div>
        <div className="site-rows">
          {MODULE_GROUPS.map((g) => (
            <div key={g.id} className="site-row site-row--two">
              <h3 className="site-h3">
                <RouterLink to={`/platform#${g.id}`}>{g.name}</RouterLink>
              </h3>
              <p className="site-row__desc">{g.modules.map((m) => m.name).join(', ')}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 28 }}>
          <RouterLink to="/platform" className="site-link">Tour the platform</RouterLink>
        </p>
      </div>
    </section>
  );
}
