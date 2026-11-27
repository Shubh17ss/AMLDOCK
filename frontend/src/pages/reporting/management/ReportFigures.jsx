import { Box, Skeleton, Typography } from '@mui/material';
import { fonts, tokens } from '../../../theme/theme.js';
import { errorText, riseSx, tileSx } from './ReportSection.jsx';

/**
 * The band that opens the report: how many deals the window holds, then where each of them stands
 * now. The four parts add up to the whole, so every deal is in exactly one. One tile split by
 * hairlines rather than five cards, so it reads as one statement with its parts.
 */
export function ReportFigures({ query, colours, windowText }) {
  const o = query.data;
  const figures = o ? [
    { label: 'Open', value: o.open, note: 'New, in review or on hold', swatch: colours.status.REVIEW },
    { label: 'Verified', value: o.verified, swatch: colours.status.VERIFIED },
    { label: 'Sold', value: o.sold, swatch: colours.status.CLOSED },
    { label: 'Closed, not sold', value: o.closedNotSold, swatch: colours.status.NEW },
  ] : [];

  return (
    <Box
      component="section"
      aria-label="Report summary"
      aria-busy={query.isFetching || undefined}
      sx={{
        ...tileSx,
        ...riseSx(0),
        p: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', md: '1.5fr repeat(4, 1fr)' },
        overflow: 'hidden',
      }}
    >
      {query.isError ? (
        <Box sx={{ gridColumn: '1 / -1', p: 3, color: tokens.muted }}>{errorText(query.error)}</Box>
      ) : (
        <>
          <Box sx={{
            gridColumn: { xs: '1 / -1', md: 'auto' },
            p: { xs: 2.5, md: 3 },
            borderBottom: { xs: `1px solid ${tokens.hairline}`, md: 'none' },
            backgroundColor: tokens.blueWash,
          }}>
            <Typography variant="body2" sx={{ color: tokens.ink, fontWeight: 500 }}>Deals created</Typography>
            {o ? (
              <Typography sx={{
                fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.045em', lineHeight: 1,
                fontSize: { xs: '3rem', md: '3.6rem' }, color: tokens.blue, mt: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {o.created.toLocaleString('en-NZ')}
              </Typography>
            ) : <Skeleton width={110} height={64} />}
            <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 1 }}>{windowText}</Typography>
          </Box>
          {(o ? figures : Array.from({ length: 4 }, () => null)).map((f, i) => (
            <Box key={f?.label ?? i} sx={{
              p: { xs: 2, md: 3 },
              borderLeft: { md: `1px solid ${tokens.hairline}` },
              // Two columns on a phone: a rule between the pair and under the first row.
              ...(i % 2 === 1 && { borderLeft: `1px solid ${tokens.hairline}` }),
              ...(i < 2 && { borderBottom: { xs: `1px solid ${tokens.hairline}`, md: 'none' } }),
              minWidth: 0,
            }}>
              {f ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '3px', backgroundColor: f.swatch, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: tokens.ink, fontWeight: 500 }}>{f.label}</Typography>
                  </Box>
                  <Typography sx={{
                    fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.1,
                    fontSize: { xs: '1.8rem', md: '2.1rem' }, color: tokens.ink, mt: 1.25,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {f.value.toLocaleString('en-NZ')}
                  </Typography>
                  {f.note && (
                    <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 0.5 }}>{f.note}</Typography>
                  )}
                </>
              ) : (
                <>
                  <Skeleton width="60%" />
                  <Skeleton width={56} height={44} />
                  <Skeleton width="80%" />
                </>
              )}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
