import { Box, Tooltip, Typography } from '@mui/material';
import { BentoTile } from '../bento/BentoTile.jsx';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * One compliance section, as a square tile on the dashboard launcher.
 *
 * <p>Quiet at rest: the section's glyph in ink on glass, its name beneath, and nothing else. The
 * counts, review dates and section numbering that used to sit out here have gone — they are
 * facts about the modules inside, and they are one click away in the panel that opens.
 *
 * <p>Colour is spent on the interaction rather than on identity. The five glyphs already tell the
 * sections apart, so the tile stays monochrome until you reach for it, and blue means "this is
 * what you are about to open" rather than "this is Documents".
 *
 * <p>Everything structural — the glass, the load stagger, the hover lift, the focus ring, the
 * keyboard handling, the reduced-motion guard — comes from {@link BentoTile}.
 */
export function SectionTile({ group, index = 0, attention = null, onOpen }) {
  return (
    <BentoTile
      index={index}
      onClick={(e) => onOpen(group, e.currentTarget)}
      ariaLabel={`Open ${group.title}`}
      sx={{
        aspectRatio: '1 / 1',
        p: 2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        textAlign: 'center',
        // Its own key rather than '&:hover', which would replace BentoTile's lift outright —
        // `sx` is spread last and the merge is shallow.
        '&:hover .tile-glyph, &:focus-visible .tile-glyph': { color: tokens.blue },
      }}
    >
      {attention && (
        <Tooltip title={attention.label}>
          <Box
            aria-label={attention.label}
            sx={{
              position: 'absolute', top: 14, right: 14,
              width: 9, height: 9, borderRadius: '50%',
              backgroundColor: attention.color,
              // Lifts the dot off the glass so it reads at a glance without a ring around it.
              boxShadow: `0 0 0 3px color-mix(in srgb, ${attention.color} 18%, transparent)`,
            }}
          />
        </Tooltip>
      )}

      <Box
        className="tile-glyph"
        sx={{
          color: tokens.ink,
          display: 'grid',
          placeItems: 'center',
          transition: 'color 0.3s ease',
          '& > svg': { fontSize: 38 },
        }}
      >
        {group.icon}
      </Box>

      <Typography sx={{
        fontFamily: fonts.display,
        fontSize: '0.98rem',
        fontWeight: 600,
        lineHeight: 1.25,
        color: tokens.ink,
      }}>
        {group.title}
      </Typography>
    </BentoTile>
  );
}
