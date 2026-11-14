import { AnimatePresence, motion } from 'motion/react';
import { Check, NodeGlyph } from '../ui/icons.jsx';
import { EASE } from '../tokens.js';

// A sample listing, shown at one of four points in its life. Statuses and their order are the
// app's own (src/data/dealStatus.js): New → In review → Verified → Closed. All names are invented.
export const STAGES = ['New', 'In review', 'Verified', 'Closed'];
const CHIP = ['new', 'review', 'verified', 'closed'];

const OWNERS = [
  { kind: 'trust',   name: 'Smith Family Trust', role: 'Vendor',            depth: 0 },
  { kind: 'person',  name: 'John Smith',         role: 'Trustee',           depth: 1 },
  { kind: 'person',  name: 'Jane Smith',         role: 'Trustee',           depth: 1 },
  { kind: 'company', name: 'Smith Holdings Ltd', role: 'Beneficiary, 60%',  depth: 1 },
  { kind: 'person',  name: 'Olivia Smith',       role: 'Director',          depth: 2 },
];
const PURCHASER = { kind: 'person', name: 'Aroha Ngata', role: 'Purchaser', depth: 0 };

const DOCS = ['Trust deed', 'Passport, John Smith', 'Driver licence, Jane Smith', 'Agency agreement'];

const TRAIL = [
  { time: '09:12', what: 'Listing created',               who: 'M. Chen, Agent' },
  { time: '11:40', what: 'Submitted for review',          who: 'M. Chen, Agent' },
  { time: '14:05', what: 'Verified, version 1 saved',     who: 'S. Patel, Compliance officer' },
  { time: '16:30', what: 'Closed as sold, purchaser added', who: 'M. Chen, Agent' },
];

const swap = { duration: 0.35, ease: EASE };

export function DealFile({ stage = 0 }) {
  const reviewed = stage >= 1;
  const owners = stage >= 3 ? [...OWNERS, PURCHASER] : OWNERS;

  return (
    <div className="mock" role="img" aria-label={`Sample listing file, status ${STAGES[stage]}`}>
      <div className="mock__head">
        <div style={{ minWidth: 0 }}>
          <div className="mock__title">12 Cuba Street, Te Aro</div>
          <div className="mock__sub">Listing <span className="site-mono">0142</span>, Wellington Central branch</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={stage}
            className={`chip chip--${CHIP[stage]}`}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {STAGES[stage]}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="mock__body mock__body--split">
        <div className="mock__pane">
          <div className="mock__label">
            <span>Ownership</span>
            <span>{reviewed ? `${OWNERS.length} of ${OWNERS.length}` : `0 of ${OWNERS.length}`} verified</span>
          </div>
          <AnimatePresence initial={false}>
            {owners.map((o, i) => (
              <motion.div
                key={o.name}
                className="tree__row"
                style={{ paddingLeft: o.depth > 1 ? (o.depth - 1) * 20 : 0 }}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={swap}
              >
                {o.depth > 0 && <span className="tree__elbow" />}
                <span className="tree__icon" data-kind={o.kind}><NodeGlyph kind={o.kind} /></span>
                <span className="tree__name">{o.name}</span>
                <span className="tree__role">{o.role}</span>
                {o === PURCHASER ? null : reviewed ? (
                  <motion.span
                    className="tree__tick"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.09 * i }}
                  >
                    <Check size={10} />
                  </motion.span>
                ) : (
                  <span className="tree__pending" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mock__pane">
          <div className="mock__label"><span>Documents</span><span>{DOCS.length}</span></div>
          {DOCS.map((d) => (
            <div key={d} className="doc">
              <span className="doc__ico" />
              <span className="doc__name">{d}</span>
              <span className="doc__state" data-ok={reviewed}>{reviewed ? 'Reviewed' : 'Uploaded'}</span>
            </div>
          ))}
          <div className="risk">
            <span style={{ fontWeight: 600 }}>Risk rating</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--s-muted)' }}>{reviewed ? 'Medium' : 'Not rated'}</span>
              <span className="risk__meter" aria-hidden="true">
                <i data-on={reviewed} /><i data-on={reviewed} /><i />
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mock__foot">
        <div className="mock__label"><span>Audit log</span></div>
        <div className="trail">
          <AnimatePresence initial={false}>
            {TRAIL.slice(0, stage + 1).map((t) => (
              <motion.div
                key={t.time}
                className="trail__row"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={swap}
              >
                <span className="trail__time">{t.time}</span>
                <span className="trail__what"><b>{t.what}</b> <span>{t.who}</span></span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
