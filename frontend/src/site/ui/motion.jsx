import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { EASE } from '../tokens.js';

/** Live media-query match. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Page-load sequence: children marked with <Rise> come up one after another. Used once per page,
 * on its opening block — sections further down do not animate in.
 */
export function Stagger({ as = 'div', children, ...rest }) {
  const Tag = motion[as];
  return (
    <Tag initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.08 } } }} {...rest}>
      {children}
    </Tag>
  );
}

export function Rise({ as = 'div', children, ...rest }) {
  const Tag = motion[as];
  return (
    <Tag
      variants={{
        hidden: { opacity: 0, y: 18 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Scroll-linked drift for product mock-ups: the figure travels `distance` px slower than the page. */
export function Parallax({ distance = 40, children, className }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}
