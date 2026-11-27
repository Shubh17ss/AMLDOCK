import { Box, Typography, useMediaQuery } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { fonts, tokens } from '../../../theme/theme.js';
import { STATUS_KEYS, statusLabel } from './reportPalette.js';

/**
 * Deals created in the window, one bar per status they stand at now, each in its status colour.
 * Each count sits under its status name rather than on the bar: one busy status (usually Closed)
 * dwarfs the rest, and a label inside a short bar would not fit.
 */
export function StatusBarChart({ overview, colours }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const labels = STATUS_KEYS.map(statusLabel);
  const counts = STATUS_KEYS.map((k) => overview.byStatus?.[k] ?? 0);
  const countOf = Object.fromEntries(labels.map((l, i) => [l, counts[i]]));
  const summary = STATUS_KEYS.map((k, i) => `${labels[i]} ${counts[i]}`).join(', ');

  return (
    <Box sx={{ position: 'relative' }} role="img" aria-label={`Deals created by status: ${summary}.`}>
      <BarChart
        height={270}
        skipAnimation={reduceMotion}
        margin={{ top: 16, right: 8, bottom: 48, left: 36 }}
        borderRadius={8}
        grid={{ horizontal: true }}
        xAxis={[{
          scaleType: 'band',
          data: labels,
          categoryGapRatio: 0.45,
          colorMap: { type: 'ordinal', values: labels, colors: STATUS_KEYS.map((k) => colours.status[k]) },
          disableTicks: true,
          // Two lines under each bar: the status, then its count. The tooltip keeps the plain name.
          valueFormatter: (label, context) => (context.location === 'tick'
            ? `${label}\n${(countOf[label] ?? 0).toLocaleString('en-NZ')}`
            : label),
        }]}
        yAxis={[{ tickMinStep: 1, disableLine: true, disableTicks: true }]}
        series={[{ data: counts, label: 'Deals created' }]}
        slotProps={{ legend: { hidden: true } }}
        sx={{
          '& .MuiChartsAxis-tickLabel': { fill: `${tokens.muted} !important`, fontFamily: fonts.body },
          '& .MuiChartsAxis-directionX .MuiChartsAxis-tickLabel tspan:last-of-type': {
            fill: `${tokens.ink} !important`, fontWeight: 600,
          },
          '& .MuiChartsGrid-line': { stroke: tokens.hairline, strokeDasharray: '3 4' },
        }}
      />
      {overview.created === 0 && (
        <Typography variant="body2" sx={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: tokens.muted,
          pointerEvents: 'none', pb: 4,
        }}>
          No deals were created in this window. Try a longer one.
        </Typography>
      )}
    </Box>
  );
}
