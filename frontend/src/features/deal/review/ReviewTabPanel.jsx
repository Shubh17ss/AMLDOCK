import { Box } from '@mui/material';
import { motion } from '../../../theme/theme.js';

/**
 * One panel of the deal's tab strip.
 *
 * <p>Renders nothing at all until its tab is chosen, which is doing real work rather than saving
 * a few nodes: the audit trail and the notes timeline each fire a query on mount, and a reviewer
 * who only opens Structure should not pay for either.
 *
 * <p>The entrance is deliberately small — a fade and a 6px rise. This is content appearing where
 * the reader is already looking, so anything more would be the interface asking for attention it
 * does not need.
 */
export function ReviewTabPanel({ value, current, children, keepMounted = false }) {
  const selected = value === current;
  if (!selected && !keepMounted) return null;

  return (
    <Box
      role="tabpanel"
      id={`deal-panel-${value}`}
      aria-labelledby={`deal-tab-${value}`}
      hidden={!selected}
      sx={motion.respectful({
        display: selected ? 'block' : 'none',
        animation: `reviewPanelIn ${motion.swift} ${motion.ease} both`,
        '@keyframes reviewPanelIn': {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'none' },
        },
      })}
    >
      {children}
    </Box>
  );
}
