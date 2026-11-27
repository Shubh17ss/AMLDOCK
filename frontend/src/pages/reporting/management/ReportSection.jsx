import { Alert, Box, Skeleton, Typography } from '@mui/material';
import { fonts, tokens } from '../../../theme/theme.js';

/** The flat tile every part of the report sits on: hairline edge, no shadow, the app's 20px. */
export const tileSx = {
  backgroundColor: tokens.tile,
  border: `1px solid ${tokens.hairline2}`,
  borderRadius: '20px',
  p: { xs: 2, md: 3 },
  minWidth: 0,
};

/**
 * The report's one orchestrated moment: on first load the parts rise into place in reading
 * order. A part whose data arrives later just swaps its placeholder; nothing moves twice.
 */
export const riseSx = (index) => ({
  opacity: 0,
  animation: 'reportRise 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
  animationDelay: `${index * 70}ms`,
  '@keyframes reportRise': {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'none' },
  },
  '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
});

/**
 * Ledger tables: right-aligned tabular figures, dashed rules between rows, and a tinted totals
 * row, after the reference report the firm already reads.
 */
export const ledgerSx = {
  '& .MuiTableCell-root': {
    borderBottom: `1px dashed ${tokens.hairline2}`,
    fontVariantNumeric: 'tabular-nums',
    py: 1.1,
    px: 1.5,
    whiteSpace: 'nowrap',
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    borderBottom: `1px solid ${tokens.hairline2}`,
    color: tokens.muted,
    fontWeight: 600,
    fontSize: '0.8rem',
  },
  // The band above the column heads that groups them, as "In this window" over three columns.
  '& .MuiTableHead-root tr.band .MuiTableCell-root': {
    borderBottom: 'none',
    color: tokens.ink,
    fontFamily: fonts.display,
    fontWeight: 500,
    fontSize: '0.85rem',
    pb: 0,
  },
  '& .MuiTableHead-root tr.band .MuiTableCell-root.grouped': {
    borderBottom: `1px solid ${tokens.hairline}`,
    textAlign: 'center',
  },
  '& .MuiTableBody-root tr.total .MuiTableCell-root': {
    backgroundColor: 'var(--cl-hover)',
    fontWeight: 600,
    color: tokens.ink,
    borderBottom: 'none',
  },
  '& .MuiTableBody-root tr.total .MuiTableCell-root:first-of-type': { borderRadius: '10px 0 0 10px' },
  '& .MuiTableBody-root tr.total .MuiTableCell-root:last-of-type': { borderRadius: '0 10px 10px 0' },
  '& .MuiTableBody-root tr:not(.total) .MuiTableCell-root:first-of-type': { color: tokens.ink, fontWeight: 500 },
  // A column-group boundary: a hairline on the left of the group's first column.
  '& .MuiTableCell-root.groupStart': { borderLeft: `1px solid ${tokens.hairline}` },
};

/** A section heading in the display face, with one line saying what is counted. */
export function SectionHeading({ id, title, description, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0, maxWidth: '72ch' }}>
        <Typography id={id} component="h2" sx={{
          fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.02em',
          fontSize: '1.2rem', lineHeight: 1.25, color: tokens.ink,
        }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>{description}</Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}

/**
 * One part of the report, bound to its own query: a placeholder until the first answer, the
 * server's own reason if it fails, and the content otherwise. While a new window or branch is
 * loading the previous figures stay up, dimmed, rather than flashing back to placeholders.
 */
export function ReportSection({ id, title, description, query, index = 0, placeholder, sx, children }) {
  const headingId = `${id}-heading`;
  const stale = query.isFetching && query.isPlaceholderData;
  return (
    <Box component="section" aria-labelledby={headingId} aria-busy={query.isFetching || undefined}
         sx={{ ...tileSx, ...riseSx(index), ...sx }}>
      <SectionHeading id={headingId} title={title} description={description} />
      {query.isError ? (
        <Alert severity="error" variant="outlined">
          {errorText(query.error)}
        </Alert>
      ) : query.data ? (
        <Box sx={{ opacity: stale ? 0.55 : 1, transition: 'opacity 180ms ease' }}>
          {children(query.data)}
        </Box>
      ) : (
        placeholder ?? <Skeleton variant="rounded" height={220} sx={{ borderRadius: '14px' }} />
      )}
    </Box>
  );
}

export function errorText(error) {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;
  if (status === 403) return 'Your role cannot see this part of the report.';
  if (message && status && status < 500) return message;
  return 'This part of the report did not load. Check your connection, then refresh the page.';
}

/** A muted footnote under a table: how a figure is counted, where it could be misread. */
export function Footnote({ children }) {
  return (
    <Typography variant="caption" component="p" sx={{ color: tokens.muted, mt: 1.5, maxWidth: '80ch', lineHeight: 1.55 }}>
      {children}
    </Typography>
  );
}
