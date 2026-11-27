import { Box, Typography, useMediaQuery } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { fonts, tokens } from '../../../theme/theme.js';

/**
 * A few bars side by side, each in its own colour, its figure printed under its name so the chart
 * reads without hovering. Used for deals listed this year against last, and for appraised against
 * closing value.
 *
 * @param bars       [{ label, value, colour }]
 * @param format     how a figure is written under its bar and in the tooltip
 * @param axisFormat how the value axis is written; defaults to `format`
 * @param note       a line under the chart, e.g. why a bar is missing
 */
export function ComparisonBarChart({ bars, format = (v) => v.toLocaleString('en-NZ'), axisFormat, ariaTitle, note }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const labels = bars.map((b) => b.label);
  const valueOf = Object.fromEntries(bars.map((b) => [b.label, b.value]));
  const summary = bars.map((b) => `${b.label} ${format(b.value)}`).join(', ');
  const empty = bars.every((b) => !b.value);

  return (
    <Box>
      <Box sx={{ position: 'relative' }} role="img" aria-label={`${ariaTitle}: ${summary}.`}>
        <BarChart
          height={270}
          skipAnimation={reduceMotion}
          margin={{ top: 16, right: 8, bottom: 52, left: axisFormat ? 56 : 40 }}
          borderRadius={8}
          grid={{ horizontal: true }}
          xAxis={[{
            scaleType: 'band',
            data: labels,
            categoryGapRatio: bars.length > 2 ? 0.45 : 0.55,
            colorMap: { type: 'ordinal', values: labels, colors: bars.map((b) => b.colour) },
            disableTicks: true,
            // Every bar keeps its name: with so few bars the library's overlap guess would hide one.
            tickLabelInterval: () => true,
            // Two lines under each bar: its name, then its figure. The tooltip keeps the plain name.
            valueFormatter: (label, context) => (context.location === 'tick'
              ? `${label}\n${format(valueOf[label] ?? 0)}`
              : label),
          }]}
          yAxis={[{
            tickMinStep: 1, disableLine: true, disableTicks: true,
            valueFormatter: axisFormat ?? ((v) => v.toLocaleString('en-NZ')),
          }]}
          series={[{ data: bars.map((b) => b.value), label: ariaTitle, valueFormatter: (v) => format(v ?? 0) }]}
          slotProps={{ legend: { hidden: true } }}
          sx={{
            '& .MuiChartsAxis-tickLabel': { fill: `${tokens.muted} !important`, fontFamily: fonts.body },
            '& .MuiChartsAxis-directionX .MuiChartsAxis-tickLabel tspan:last-of-type': {
              fill: `${tokens.ink} !important`, fontWeight: 600,
            },
            '& .MuiChartsGrid-line': { stroke: tokens.hairline, strokeDasharray: '3 4' },
          }}
        />
        {empty && (
          <Typography variant="body2" sx={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: tokens.muted,
            pointerEvents: 'none', pb: 5,
          }}>
            Nothing to show for this window. Try a longer one.
          </Typography>
        )}
      </Box>
      {note && <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 0.5 }}>{note}</Typography>}
    </Box>
  );
}
