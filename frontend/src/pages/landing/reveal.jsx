import { useEffect, useRef, useState } from 'react';

/** True once the element scrolls into view (fires once, then disconnects). */
export function useInView(options = { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}

/** Tracks the user's reduced-motion preference, live. */
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduce;
}

/**
 * Reveals its children on scroll: fades up from opacity 0 / translateY(y) to resting.
 * `delay` (ms) staggers siblings. Honours prefers-reduced-motion (renders resting, no motion).
 */
export function Reveal({ children, delay = 0, y = 18, className, style }) {
  const [ref, inView] = useInView();
  const reduce = usePrefersReducedMotion();
  const shown = inView || reduce;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${y}px)`,
        transition: reduce
          ? 'none'
          : `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
