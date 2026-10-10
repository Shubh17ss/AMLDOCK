import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { countryName, flagClass } from '../../data/countries.js';
import { nodeTypeLabel } from '../../api/ownership.js';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * A date in a register column: "27 Sep 2026", or an em dash for one nobody has recorded.
 *
 * <p>Takes a date or an instant — every register renders both the same way, and a second
 * Intl.DateTimeFormat elsewhere would be the same format written twice.
 */
export function formatListDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

/** ISO alpha-2 with its flag, or an em dash. Shared so both registers spell "unanswered" alike. */
export function CountryCell({ code }) {
  if (!code) return <Typography component="span" sx={{ color: tokens.muted }}>—</Typography>;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <span className={flagClass(code)} />
      <span>{countryName(code) ?? code}</span>
    </Box>
  );
}

/**
 * The rows both CDD registers show.
 *
 * <p>The same person on two deals is two rows on purpose. These registers answer "who has this
 * branch done diligence on, and against which file" — the file is half the answer, and collapsing
 * the duplicates would hide the more interesting fact, that someone turned up twice.
 */
export function IndividualsTable({ rows, loading, emptyMessage }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Date of birth</TableCell>
            <TableCell>Country of residence</TableCell>
            <TableCell>Property</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.nodeId} hover>
              <TableCell>{r.displayName}</TableCell>
              {/* A trust and the person behind it are two rows that otherwise look alike and read
                  very differently. The columns after this one are person-shaped and show a dash
                  for an entity — a company has an incorporation date, not a birthday. */}
              <TableCell sx={{ color: tokens.muted }}>{nodeTypeLabel(r.nodeType)}</TableCell>
              <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem' }}>
                {/* A birthday nobody recorded reads as a gap, not as a blank cell. */}
                {formatListDate(r.dateOfBirth)}
              </TableCell>
              <TableCell><CountryCell code={r.countryOfResidence} /></TableCell>
              <TableCell>
                {/* Straight to the deal the person stands on — the register is a way in, not a
                    dead end. The Assurance register's link treatment: ink at rest, blue and
                    underlined on hover. */}
                <Tooltip title={r.propertyAddress ?? ''}>
                  <Box
                    component={RouterLink}
                    to={`/deals/${r.dealId}`}
                    sx={{
                      display: 'inline-block', maxWidth: 380, verticalAlign: 'bottom',
                      fontWeight: 700, color: tokens.ink, textDecoration: 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      '&:hover': { color: tokens.blue, textDecoration: 'underline' },
                    }}
                  >
                    {r.propertyAddress ?? r.dealReference}
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 5, color: tokens.muted }}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
