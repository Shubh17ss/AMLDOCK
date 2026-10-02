import { useCallback, useEffect, useState } from 'react';
import { Box, IconButton, Modal, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { ModuleCard } from './ModuleCard.jsx';
import { tokens, fonts, shadows } from '../../theme/theme.js';

const OPEN_MS = 320;
const CLOSE_MS = 200;

/**
 * A section, opened.
 *
 * <p>The panel grows out of the tile that was clicked rather than arriving from the middle of the
 * screen: the origin is the tile's own centre, so the movement says which tile this came from and
 * where it will go back to. That is the one piece of non-trivial motion on this page, and it
 * answers an action rather than decorating a load.
 *
 * <p>Built on MUI's `Modal` for the focus trap, Escape, scroll lock and `aria-modal`, but with
 * `hideBackdrop` and our own: the page behind is frosted rather than dimmed, which keeps the
 * launcher legible underneath and matches the glass the rest of the workspace is made of.
 */
export function SectionOverlay({ open, group, originRect, onClose, reviewPropsFor }) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => setClosing(true), []);

  // The close is played before the Modal unmounts, so the panel shrinks back toward its tile
  // instead of vanishing. Resetting `closing` here rather than on open keeps the two states from
  // racing when a second tile is opened quickly.
  useEffect(() => {
    if (!closing) return undefined;
    const t = setTimeout(() => { setClosing(false); onClose(); }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  if (!group) return null;

  // Where the tile sat, expressed as an offset from the centre of the viewport — which is also
  // the centre of the panel. Scaling from that point is what makes the panel look like it grew
  // out of the tile. Falls back to the panel's own centre if we were opened without a rect.
  const dx = originRect ? originRect.left + originRect.width / 2 - window.innerWidth / 2 : 0;
  const dy = originRect ? originRect.top + originRect.height / 2 - window.innerHeight / 2 : 0;

  const count = group.items.length;

  // The panel is as wide as its cards need and no wider. A fixed 1000px left a section of two
  // modules sitting in a third of its own panel, because the auto-fill grid keeps the empty
  // track. CARD_MIN + GAP per card, plus the body's padding, capped so a five-module section
  // wraps instead of running off the screen.
  const CARD_MIN = 280;
  const GAP = 16;
  const PAD = 58;   // 2 × 28px padding + the panel's 1px borders
  // Floored as well as capped: at one card the panel was narrow enough to wrap its own header
  // onto two lines, which read as cramped rather than as compact.
  const fitted = Math.min(Math.max(count * CARD_MIN + (count - 1) * GAP + PAD, 420), 1000);

  return (
    <Modal open={open} onClose={requestClose} hideBackdrop aria-labelledby="section-overlay-title">
      <Box sx={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', p: { xs: 2, md: 4 } }}>
        {/* Frosted, not dimmed. Sourced from the theme so it inverts with the rest of the
            surface — a literal white here would be white-on-white in dark mode. */}
        <Box
          onClick={requestClose}
          sx={{
            position: 'absolute', inset: 0,
            background: tokens.glassBg,
            backdropFilter: 'blur(10px) saturate(160%)',
            WebkitBackdropFilter: 'blur(10px) saturate(160%)',
            opacity: 0,
            animation: `${closing ? 'overlayOut' : 'overlayIn'} ${closing ? CLOSE_MS : OPEN_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`,
            '@keyframes overlayIn': { from: { opacity: 0 }, to: { opacity: 1 } },
            '@keyframes overlayOut': { from: { opacity: 1 }, to: { opacity: 0 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: closing ? 0 : 1 },
          }}
        />

        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: fitted,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            // A larger radius than the 20px tile it came from: the hierarchy is carried by the
            // form rather than by adding anything to it.
            borderRadius: '24px',
            border: `1px solid ${tokens.glassBorder}`,
            background: tokens.panelBg,
            backdropFilter: 'blur(18px) saturate(180%)',
            WebkitBackdropFilter: 'blur(18px) saturate(180%)',
            boxShadow: shadows.glassHover,
            outline: 'none',
            transformOrigin: `calc(50% + ${dx}px) calc(50% + ${dy}px)`,
            opacity: 0,
            animation: `${closing ? 'panelBack' : 'panelOut'} ${closing ? CLOSE_MS : OPEN_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`,
            '@keyframes panelOut': {
              from: { opacity: 0, transform: 'scale(0.35)' },
              to: { opacity: 1, transform: 'scale(1)' },
            },
            '@keyframes panelBack': {
              from: { opacity: 1, transform: 'scale(1)' },
              to: { opacity: 0, transform: 'scale(0.35)' },
            },
            // No scale for anyone who asked not to be moved — the panel simply is, or isn't.
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              opacity: closing ? 0 : 1,
              transform: 'none',
            },
          }}
        >
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 2,
            px: { xs: 2.5, md: 3.5 }, py: { xs: 2, md: 2.5 },
            borderBottom: `1px solid ${tokens.hairline}`,
          }}>
            <Box sx={{
              width: 42, height: 42, borderRadius: '13px', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              backgroundColor: tokens.blueWash, color: tokens.blue,
              '& > svg': { fontSize: 22 },
            }}>
              {group.icon}
            </Box>

            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography id="section-overlay-title" sx={{
                fontFamily: fonts.display, fontWeight: 800, fontSize: '1.5rem',
                letterSpacing: '-0.03em', color: tokens.ink, lineHeight: 1.15,
              }}>
                {group.title}
              </Typography>
              <Typography
                component={RouterLink}
                to={group.to}
                onClick={requestClose}
                sx={{
                  fontSize: '0.85rem', color: tokens.muted, textDecoration: 'none',
                  '&:hover': { color: tokens.blue, textDecoration: 'underline' },
                }}
              >
                {count} {count === 1 ? 'module' : 'modules'} — open the full section
              </Typography>
            </Box>

            <Tooltip title="Close">
              <IconButton onClick={requestClose} sx={{ flexShrink: 0 }}>
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* The cards wrap instead of scrolling sideways. The old row clipped its last card
              mid-word whenever a section held more than three. */}
          <Box sx={{
            overflowY: 'auto',
            // Explicit, because it would not be 'visible' anyway: CSS resolves overflow-x to
            // 'auto' the moment overflow-y is not visible, so a single sub-pixel of horizontal
            // overflow raises a scrollbar. That is what put one under AML Training's lone card.
            overflowX: 'hidden',
            px: { xs: 2.5, md: 3.5 },
            py: { xs: 2.5, md: 3 },
            display: 'grid',
            gap: { xs: 1.5, md: 2 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' },
          }}>
            {group.items.map((item, i) => (
              <ModuleCard
                key={item.id}
                label={item.label}
                to={item.to}
                index={i}
                {...(reviewPropsFor(item) ?? {})}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
