import { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { DealFile, STAGES } from '../mock/DealFile.jsx';
import { useMediaQuery } from '../ui/motion.jsx';
import { Chevron } from '../ui/icons.jsx';
import { EASE } from '../tokens.js';

const STEPS = [
  {
    who: 'Agent',
    title: 'Open the listing',
    body: 'Record the property and the client, build the ownership structure behind them, and upload the identity documents you were given.',
  },
  {
    who: 'Compliance officer',
    title: 'Review every owner',
    body: 'Check each person and entity in the structure against their documents, mark them verified, and set the risk rating.',
  },
  {
    who: 'Compliance officer',
    title: 'Sign it off',
    body: 'Verifying saves a numbered version of the file. What was signed off stays exactly as it was, even if the listing is reopened later.',
  },
  {
    who: 'Agent',
    title: 'Close when it sells',
    body: 'Record the outcome. If the property sold, the purchaser’s side opens so their due diligence sits in the same file.',
  },
];

/**
 * The site's centrepiece: one sample listing that fills in as it moves through the lifecycle.
 *
 * Desktop: the section is a tall track with a pinned stage, and scroll position picks the step.
 * Below 1024px, or when the reader asked for reduced motion, nothing pins — the steps become
 * tabs with previous/next and swipe, and reduced motion opens on the completed file.
 */
export function DealLifecycle() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const pinned = desktop && !reduce;
  const last = STEPS.length - 1;
  const [stage, setStage] = useState(reduce ? last : 0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (pinned) setStage(Math.min(last, Math.floor(p * STEPS.length)));
  });

  const go = (i) => {
    const next = Math.max(0, Math.min(last, i));
    if (!pinned) { setStage(next); return; }
    // Pinned: the step is a function of scroll, so move the scroll to the middle of its band.
    const el = ref.current;
    const track = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + track * ((next + 0.5) / STEPS.length), behavior: 'smooth' });
  };

  const step = STEPS[stage];

  return (
    <section ref={ref} className="site-life" data-pinned={pinned} aria-label="How a listing moves through AMLDOCK">
      <div className="site-life__stage">
        <div className="site-wrap">
          <div className="site-life__grid">
            {/* Desktop: all four steps, the current one opened. */}
            <div className="site-life__steps">
              <span className="site-life__rail" aria-hidden="true">
                {pinned
                  ? <motion.i style={{ scaleY: scrollYProgress }} />
                  : <i style={{ transform: `scaleY(${(stage + 1) / STEPS.length})` }} />}
              </span>
              {STEPS.map((s, i) => (
                <button
                  key={s.title} type="button" className="site-life__step"
                  aria-current={i === stage ? 'step' : undefined}
                  onClick={() => go(i)}
                >
                  <span className="who">{s.who}</span>
                  <h3>{s.title}</h3>
                  <motion.p
                    initial={false}
                    animate={{ height: i === stage ? 'auto' : 0, opacity: i === stage ? 1 : 0, marginTop: i === stage ? 8 : 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                  >
                    {s.body}
                  </motion.p>
                </button>
              ))}
            </div>

            {/* Mobile: tabs, then the current step's copy. */}
            <div className="site-life__tabs">
              {STEPS.map((s, i) => (
                <button
                  key={s.title} type="button" className="site-life__tab"
                  data-done={i <= stage} aria-current={i === stage ? 'step' : undefined}
                  aria-label={`${STAGES[i]}: ${s.title}`}
                  onClick={() => go(i)}
                >
                  <span className="bar" />
                  <span className="lbl">{STAGES[i]}</span>
                </button>
              ))}
            </div>
            <div className="site-life__copy" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="who">{step.who}</p>
                  <h3>{step.title}</h3>
                  <p className="site-body">{step.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.div
              style={{ touchAction: 'pan-y' }}
              onPanEnd={(_, info) => {
                if (pinned || Math.abs(info.offset.x) < 60 || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
                go(stage + (info.offset.x < 0 ? 1 : -1));
              }}
            >
              <DealFile stage={stage} />
              <div className="site-life__swipe">
                <span>Step {stage + 1} of {STEPS.length}</span>
                <span className="site-life__arrows">
                  <button type="button" className="site-life__arrow" onClick={() => go(stage - 1)} disabled={stage === 0} aria-label="Previous step">
                    <Chevron flip />
                  </button>
                  <button type="button" className="site-life__arrow" onClick={() => go(stage + 1)} disabled={stage === last} aria-label="Next step">
                    <Chevron />
                  </button>
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
