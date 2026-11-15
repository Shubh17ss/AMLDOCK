import { Box, Tooltip, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { tokens, fonts, shadows } from '../../theme/theme.js';

/**
 * One compliance section, as a tile on the dashboard launcher.
 *
 * <p>Flat and quiet at rest: a white tile on a hairline, the section's glyph, its name and how
 * many modules are inside. Review dates and counts per module are facts about the modules, and
 * they are one click away in the panel that opens.
 *
 * <p>Colour is spent on the interaction rather than on identity. The glyphs already tell the
 * sections apart, so the tile stays monochrome until you reach for it: the edge darkens, the glyph
 * turns blue and an arrow arrives, which together say "this is what you are about to open".
 *
 * <p>On a phone the tile lies down into a row — glyph, name, arrow — because five squares the full
 * width of the screen is five screens of scrolling.
 *
 * <p>Its own element rather than a {@link BentoTile}: that one is glass, and this one is not. The
 * things BentoTile gave it are restated here — button role, Enter/Space, the load stagger and the
 * reduced-motion guard.
 */
export function SectionTile({ group, index = 0, attention = null, onOpen }) {
  const count = group.items.length;
  const open = (e) => onOpen(group, e.currentTarget);

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Open ${group.title}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
      }}
      sx={{
        display: 'grid',
        alignItems: { xs: 'center', sm: 'start' },
        columnGap: 2,
        gridTemplateColumns: { xs: 'auto minmax(0, 1fr) auto auto', sm: 'minmax(0, 1fr) auto' },
        gridTemplateRows: { sm: '1fr auto' },
        gridTemplateAreas: {
          xs: '"glyph text alert arrow"',
          sm: '"glyph alert" "text arrow"',
        },
        minHeight: { xs: 76, sm: 176 },
        p: { xs: 2, sm: 2.5 },
        minWidth: 0,
        cursor: 'pointer',
        backgroundColor: tokens.tile,
        border: `1px solid ${tokens.hairline2}`,
        borderRadius: '20px',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        // Load stagger, as the tiles had on glass.
        opacity: 0,
        animation: 'tileRise 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        animationDelay: `${Math.min(index, 12) * 55}ms`,
        '@keyframes tileRise': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        '&:hover, &:focus-visible': { borderColor: tokens.ink },
        '&:hover .tile-glyph, &:focus-visible .tile-glyph': { color: tokens.blue },
        '&:hover .tile-arrow, &:focus-visible .tile-arrow': { opacity: 1, transform: 'none', color: tokens.ink },
        '&:focus-visible': { outline: 'none', boxShadow: shadows.focus },
        '@media (prefers-reduced-motion: reduce)': {
          opacity: 1,
          animation: 'none',
          '& .tile-arrow': { transition: 'none' },
        },
      }}
    >
      <Box
        className="tile-glyph"
        sx={{
          gridArea: 'glyph',
          color: tokens.ink,
          display: 'flex',
          transition: 'color 0.2s ease',
          '& > svg': { fontSize: { xs: 26, sm: 30 } },
        }}
      >
        {group.icon}
      </Box>

      {/* An alert sign in the state's colour: red when a review is overdue, amber when one has
          no date. The same glyphs the module cards use. */}
      {attention && (
        <Tooltip title={attention.label}>
          <Box aria-label={attention.label} role="img" sx={{ gridArea: 'alert', display: 'flex', lineHeight: 0 }}>
            <attention.Icon sx={{ fontSize: 20, color: attention.color }} />
          </Box>
        </Tooltip>
      )}

      <Box sx={{ gridArea: 'text', minWidth: 0, alignSelf: { sm: 'end' } }}>
        <Typography sx={{
          fontFamily: fonts.display,
          fontSize: { xs: '1rem', sm: '1.12rem' },
          fontWeight: 500,
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
          color: tokens.ink,
        }}>
          {group.title}
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.4, color: tokens.muted, mt: 0.25 }}>
          {count} {count === 1 ? 'module' : 'modules'}
        </Typography>
      </Box>

      {/* Hidden until reached for on a pointer screen; always there on a phone, where there is
          no hover to reveal it. */}
      <Box
        className="tile-arrow"
        aria-hidden
        sx={{
          gridArea: 'arrow',
          alignSelf: { sm: 'end' },
          display: 'flex',
          color: tokens.muted,
          opacity: { xs: 1, sm: 0 },
          transform: { xs: 'none', sm: 'translateX(-6px)' },
          transition: 'opacity 0.2s ease, transform 0.3s cubic-bezier(0.22,1,0.36,1), color 0.2s ease',
        }}
      >
        <ArrowForwardRoundedIcon sx={{ fontSize: 20 }} />
      </Box>
    </Box>
  );
}
