import { Box, Typography, useMediaQuery } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { fonts, tokens } from '../../../theme/theme.js';

const WIDTH = 240;
const HEIGHT = 128;
const OUTER = 116;
const INNER = 80;

/**
 * A half-ring of shares with its legend: what each slice is, how many, and what share. Used for
 * risk ratings and assurance verdicts. The total sits in the ring's mouth, so the legend's
 * percentages have something visible to be a share of.
 *
 * @param slices [{ key, label, value, colour }] in the order to draw and list them
 * @param unit   what is being counted, singular and plural, e.g. ['deal', 'deals']
 * @param track  the empty ring's colour, as hex: the chart derives hover shades from it
 */
export function BreakdownDonut({ slices, unit, ariaTitle, track = '#E7ECF3' }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const total = slices.reduce((n, s) => n + s.value, 0);
  const empty = total === 0;
  // An empty window still draws the ring, as a grey track, so the layout does not jump about.
  const data = empty
    ? [{ id: 'none', value: 1, label: 'None', color: track }]
    : slices.filter((s) => s.value > 0).map((s) => ({ id: s.key, value: s.value, label: s.label, color: s.colour }));
  const summary = slices.map((s) => `${s.label} ${s.value}`).join(', ');

  // Ring above its legend at every width: three across, a tile is too narrow to put them side by side.
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
      <Box sx={{ position: 'relative', width: WIDTH, height: HEIGHT + 4, flexShrink: 0 }}
           role="img" aria-label={`${ariaTitle}: ${summary}.`}>
        <PieChart
          width={WIDTH}
          height={HEIGHT + 4}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          skipAnimation={reduceMotion}
          series={[{
            data,
            innerRadius: INNER,
            outerRadius: OUTER,
            paddingAngle: empty ? 0 : 1.5,
            cornerRadius: 5,
            startAngle: -90,
            endAngle: 90,
            cx: WIDTH / 2,
            cy: HEIGHT,
            highlightScope: { fade: 'global', highlight: 'item' },
          }]}
          tooltip={{ trigger: empty ? 'none' : 'item' }}
          slotProps={{ legend: { hidden: true } }}
        />
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <Typography sx={{
            fontFamily: fonts.display, fontWeight: 500, fontSize: '1.9rem', letterSpacing: '-0.03em',
            lineHeight: 1, color: tokens.ink, fontVariantNumeric: 'tabular-nums',
          }}>
            {total.toLocaleString('en-NZ')}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted }}>{total === 1 ? unit[0] : unit[1]}</Typography>
        </Box>
      </Box>

      <Box component="dl" sx={{ m: 0, width: '100%', maxWidth: 320, display: 'grid', rowGap: 1.25 }}>
        {slices.map((s) => (
          <Box key={s.key} sx={{ display: 'grid', gridTemplateColumns: '12px 1fr auto auto', alignItems: 'center', columnGap: 1.25 }}>
            <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '3px', backgroundColor: s.colour }} />
            <Typography component="dt" variant="body2" sx={{ color: tokens.ink }}>{s.label}</Typography>
            <Typography component="dd" variant="body2" sx={{
              m: 0, fontWeight: 600, color: tokens.ink, fontVariantNumeric: 'tabular-nums', textAlign: 'right',
            }}>
              {s.value.toLocaleString('en-NZ')}
            </Typography>
            <Typography component="dd" variant="caption" sx={{
              m: 0, color: tokens.muted, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right',
            }}>
              {total ? `${Math.round((s.value / total) * 100)}%` : '–'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
