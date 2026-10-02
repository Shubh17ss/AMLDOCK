import { Box, Typography } from '@mui/material';
import { tokens, fonts, motion } from '../theme/theme.js';

/**
 * One choice in a row of coloured, single-select pills: a dot, a label, and an optional mono tag.
 *
 * <p>Lifted out of the risk panel's band control so the status dialog draws the same thing. Two
 * hand-copied versions of one control drift the first time somebody nudges a padding in one of
 * them.
 *
 * Props:
 *   label: what the pill says
 *   fg: the pill's colour — dot, text and the selected border
 *   bg: its wash. Unselected pills show it at half strength, so every option carries its colour
 *       without having to be picked first
 *   selected, disabled, onSelect
 *   tag: small mono marker after the label ("CALCULATED", "OVERRIDE"), optional
 *   tagColor: defaults to muted
 *   ariaLabel: overrides the accessible name, optional
 *   sx: merged last, for layout (e.g. full width on phones)
 */
export function OptionPill({
  label, fg, bg, selected, disabled = false, onSelect, tag, tagColor = tokens.muted, ariaLabel, sx,
}) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
      sx={motion.respectful({
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        px: 1.75, py: 0.75, borderRadius: '10px',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        // The unselected border is transparent rather than absent: removing it outright would
        // shrink the box by 2px and make the row jump every time the selection moves.
        border: `1px solid ${selected ? fg : 'transparent'}`,
        backgroundColor: selected ? bg : `color-mix(in srgb, ${bg} 50%, transparent)`,
        color: fg,
        fontSize: '0.82rem',
        fontWeight: selected ? 700 : 400,
        // Without it a read-only viewer would be looking at live-seeming buttons, none of which
        // they may press.
        opacity: disabled && !selected ? 0.65 : 1,
        transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease`,
        '&:hover': disabled ? {} : { backgroundColor: bg },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
        ...sx,
      })}
    >
      <Box
        component="span"
        sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: fg }}
      />
      {label}
      {tag && (
        <Typography
          component="span"
          sx={{ fontFamily: fonts.mono, fontSize: '0.58rem', letterSpacing: '0.06em', color: tagColor }}
        >
          {tag}
        </Typography>
      )}
    </Box>
  );
}
