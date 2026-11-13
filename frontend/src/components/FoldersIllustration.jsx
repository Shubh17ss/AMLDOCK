import { Box } from '@mui/material';
import { tokens } from '../theme/theme.js';

/**
 * Three overlapping folders, drawn in ink on paper — the header of a drawer's Documents tab.
 *
 * <p>Black and white by construction: every stroke is `tokens.ink` and every fill the tile colour,
 * so it inverts with the theme rather than needing a dark-mode copy. Decorative only.
 */
export function FoldersIllustration({ width = 104 }) {
  const stroke = tokens.ink;
  const paper = tokens.tile;
  // One folder: a tab on the back sheet, a front sheet over it.
  const folder = (x, y, rotate) => (
    <g transform={`translate(${x} ${y}) rotate(${rotate} 30 22)`}>
      <path
        d="M2 6 a4 4 0 0 1 4 -4 h14 l5 5 h29 a4 4 0 0 1 4 4 v29 a4 4 0 0 1 -4 4 h-48 a4 4 0 0 1 -4 -4 z"
        fill={paper} stroke={stroke} strokeWidth="2" strokeLinejoin="round"
      />
      <path
        d="M2 15 h56 v24 a4 4 0 0 1 -4 4 h-48 a4 4 0 0 1 -4 -4 z"
        fill={paper} stroke={stroke} strokeWidth="2" strokeLinejoin="round"
      />
      <line x1="10" y1="23" x2="30" y2="23" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </g>
  );

  return (
    <Box
      component="svg"
      viewBox="0 0 120 72"
      aria-hidden
      sx={{ width, height: 'auto', display: 'block', mx: 'auto' }}
    >
      {folder(6, 18, -10)}
      {folder(54, 16, 10)}
      {folder(30, 8, 0)}
    </Box>
  );
}
